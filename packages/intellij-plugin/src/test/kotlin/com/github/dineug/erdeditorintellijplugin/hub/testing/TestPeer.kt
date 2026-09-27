package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.transport.HubChannel
import com.github.dineug.erdeditorintellijplugin.hub.transport.NamedPipeChannel
import com.sun.jna.Native
import com.sun.jna.platform.win32.Kernel32
import com.sun.jna.platform.win32.WinBase
import com.sun.jna.platform.win32.WinError
import com.sun.jna.platform.win32.WinNT
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.UnixDomainSocketAddress
import java.nio.ByteBuffer
import java.nio.channels.SocketChannel
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * A peer of the hub over a real transport, as the MCP server's net.connect is one: a unix socket on
 * macOS and Linux, a named pipe on Windows through an overlapped client (the hub's own pipe channel,
 * since a synchronous handle would block every write behind a pending read). A reader thread splits
 * what arrives into lines, which receiveFrames takes in order; awaitEof waits for the hub's EOF.
 */
class TestPeer private constructor(private val channel: HubChannel, reading: Boolean) : AutoCloseable {
    private val frames = LinkedBlockingQueue<String>()
    private val ended = CountDownLatch(1)
    private val resumed = CountDownLatch(if (reading) 0 else 1)

    /** Why reading ended when it was not a clean EOF, such as a reset or this peer's own close. */
    @Volatile
    var endCause: IOException? = null
        private set

    private val reader = Thread(::readLoop, "erd-test-peer-${counter.incrementAndGet()}").apply {
        isDaemon = true
        start()
    }

    /** Writes each line with its newline, all in one write. */
    fun send(vararg lines: String) {
        sendRaw(lines.joinToString("") { "$it\n" }.toByteArray(Charsets.UTF_8))
    }

    fun sendRaw(bytes: ByteArray) {
        channel.write(bytes)
    }

    /** Starts reading, for a peer connected with reading false: until then the hub's writes back up. */
    fun resume() {
        resumed.countDown()
    }

    /** The next count frames, newline dropped; fails with what did arrive after timeoutMs. */
    fun receiveFrames(count: Int, timeoutMs: Long = 5_000): List<String> {
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs)
        val received = ArrayList<String>(count)
        while (received.size < count) {
            val left = deadline - System.nanoTime()
            val frame = frames.poll(maxOf(left, 0), TimeUnit.NANOSECONDS)
                ?: throw AssertionError("received ${received.map(::preview)} of $count frames within $timeoutMs ms")
            received += frame
        }
        return received
    }

    /** Waits until reading ended; the frames that arrived and were not taken yet. */
    fun awaitEof(timeoutMs: Long = 5_000): List<String> {
        if (!ended.await(timeoutMs, TimeUnit.MILLISECONDS)) {
            throw AssertionError("the hub did not end the stream within $timeoutMs ms")
        }
        return received()
    }

    /** The frames that arrived and were not taken yet, without waiting for more. */
    fun received(): List<String> = ArrayList<String>().also { frames.drainTo(it) }

    /** Whether reading ended, by the hub's EOF, a failure or this peer's close. */
    val isEnded: Boolean get() = ended.count == 0L

    fun shutdownOutput() {
        channel.shutdownOutput()
    }

    override fun close() {
        resume()
        channel.destroy()
        reader.join(5_000)
        channel.close()
    }

    private fun readLoop() {
        val buffer = ByteArray(64 * 1024)
        val line = ByteArrayOutputStream()
        try {
            resumed.await()
            while (true) {
                val count = channel.read(buffer)
                if (count < 0) return
                var start = 0
                for (index in 0 until count) {
                    if (buffer[index] != NEWLINE) continue
                    line.write(buffer, start, index - start)
                    frames.put(line.toString(Charsets.UTF_8))
                    line.reset()
                    start = index + 1
                }
                line.write(buffer, start, count - start)
            }
        } catch (e: IOException) {
            endCause = e
        } catch (e: InterruptedException) {
            // Only a suite interrupts a peer's reader, to stop it.
        } finally {
            ended.countDown()
        }
    }

    companion object {
        private const val NEWLINE = '\n'.code.toByte()
        private val counter = AtomicInteger()

        /** Connects to pipe; with reading false nothing is read until resume. */
        fun connect(pipe: String, reading: Boolean = true, timeoutMs: Long = 5_000): TestPeer {
            val channel = if (HubPlatform.current().isWindows) openPipe(pipe, timeoutMs) else openSocket(pipe)
            return TestPeer(channel, reading)
        }

        private fun preview(frame: String): String = if (frame.length > 80) frame.take(80) + "…" else frame

        private fun openSocket(pipe: String): HubChannel = PlainSocketChannel(SocketChannel.open(UnixDomainSocketAddress.of(pipe)))

        // Node's client retries a pipe whose instances are all busy the same way, in WaitNamedPipe.
        private fun openPipe(pipe: String, timeoutMs: Long): HubChannel {
            val kernel = Kernel32.INSTANCE
            val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs)
            while (true) {
                val handle = kernel.CreateFile(
                    pipe, WinNT.GENERIC_READ or WinNT.GENERIC_WRITE, 0, null, WinNT.OPEN_EXISTING,
                    WinNT.FILE_FLAG_OVERLAPPED, null,
                )
                if (handle != null && handle != WinBase.INVALID_HANDLE_VALUE) {
                    return try {
                        NamedPipeChannel(handle)
                    } catch (e: IOException) {
                        kernel.CloseHandle(handle)
                        throw e
                    }
                }
                val error = Native.getLastError()
                if (error != WinError.ERROR_PIPE_BUSY || System.nanoTime() > deadline) {
                    throw IOException("CreateFile of $pipe failed with Windows error $error")
                }
                kernel.WaitNamedPipe(pipe, 100)
            }
        }
    }
}

/**
 * A client socket with no rules of its own: it writes after the hub's FIN and reads to the end,
 * where the hub's channel would drop or refuse, so a suite sees what the hub itself does.
 */
private class PlainSocketChannel(private val socket: SocketChannel) : HubChannel {
    override fun read(buffer: ByteArray): Int = socket.read(ByteBuffer.wrap(buffer))

    override fun write(bytes: ByteArray) {
        val buffer = ByteBuffer.wrap(bytes)
        while (buffer.hasRemaining()) socket.write(buffer)
    }

    override fun shutdownOutput() {
        socket.shutdownOutput()
    }

    override fun destroy() {
        socket.close()
    }

    override fun close() {
        socket.close()
    }
}

/** The channels a listener accepted, in order, for a suite that drives the hub's side itself. */
class AcceptedChannels : (HubChannel) -> Unit {
    private val accepted = LinkedBlockingQueue<HubChannel>()

    override fun invoke(channel: HubChannel) {
        accepted.put(channel)
    }

    fun take(timeoutMs: Long = 5_000): HubChannel =
        accepted.poll(timeoutMs, TimeUnit.MILLISECONDS) ?: throw AssertionError("no channel was accepted within $timeoutMs ms")

    fun isEmpty(): Boolean = accepted.isEmpty()
}

/** Reads the hub's side until count lines arrived; bytes after the last one are not kept. */
fun HubChannel.readLines(count: Int): List<String> {
    val bytes = ByteArrayOutputStream()
    val buffer = ByteArray(64 * 1024)
    var lines = 0
    while (lines < count) {
        val read = read(buffer)
        if (read < 0) throw AssertionError("EOF after $lines of $count lines")
        for (index in 0 until read) if (buffer[index] == '\n'.code.toByte()) lines++
        bytes.write(buffer, 0, read)
    }
    return bytes.toString(Charsets.UTF_8).split('\n').take(count)
}
