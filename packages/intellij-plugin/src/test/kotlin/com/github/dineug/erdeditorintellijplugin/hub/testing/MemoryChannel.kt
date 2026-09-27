package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.transport.HubChannel
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InterruptedIOException
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Both ends of one connection in memory, as packages/agent-hub-host's createMemorySocketPair: the
 * peer side sends raw chunks and reads the frames the hub wrote; the hub side is a HubChannel that
 * records a destroy, a graceful end and a close, can hold writes as a full socket does, and fail the
 * next write. It behaves as UnixSocketChannel does: a write after an end, a destroy or the peer's EOF
 * is dropped, and a read after destroy fails.
 */
class MemoryChannel : HubChannel {
    private val lock = ReentrantLock()
    private val changed = lock.newCondition()
    private val chunks = ArrayDeque<ByteArray>()
    private var chunkOffset = 0
    private var peerEnded = false
    private var hubReading = false
    private var hubReadEnded = false
    private var held = false
    private var writeBlocked = false
    private val failures = ArrayDeque<IOException>()
    private val bytes = ByteArrayOutputStream()
    private val frames = ArrayList<String>()
    private var writesAfterEnd = 0
    private var closes = 0

    @Volatile
    var isDestroyed: Boolean = false
        private set

    @Volatile
    var isOutputShutdown: Boolean = false
        private set

    /** Writes each line with its newline, all in one chunk. */
    fun send(vararg lines: String) {
        sendText(lines.joinToString("") { "$it\n" })
    }

    /** Writes text exactly as given, one chunk, as a corpus piece is written. */
    fun sendText(text: String) {
        sendRaw(text.toByteArray(Charsets.UTF_8))
    }

    fun sendRaw(chunk: ByteArray) {
        lock.withLock {
            chunks.addLast(chunk)
            changed.signalAll()
        }
    }

    /** The peer ends its side: the hub reads EOF once it read everything sent before. */
    fun closeFromPeer() {
        lock.withLock {
            peerEnded = true
            changed.signalAll()
        }
    }

    /** Every frame the hub wrote, newline dropped, in order. */
    val received: List<String> get() = lock.withLock { frames.toList() }

    /** Writes the hub attempted after it ended or destroyed the stream; a correct hub makes none. */
    val lateWrites: Int get() = lock.withLock { writesAfterEnd }

    val closeCount: Int get() = lock.withLock { closes }

    /** The hub waits in read with every byte sent so far taken; it has served what it read, or will. */
    val isReadWaiting: Boolean get() = lock.withLock { hubReading && chunks.isEmpty() }

    /** The hub's read returned EOF or failed, so it reads no more. */
    val isReadEnded: Boolean get() = lock.withLock { hubReadEnded }

    /** Holds every write until release, as a peer that stops reading fills a socket. */
    fun hold(): () -> Unit {
        lock.withLock { held = true }
        return {
            lock.withLock {
                held = false
                changed.signalAll()
            }
        }
    }

    /** A write waits in a hold. */
    val isWriteBlocked: Boolean get() = lock.withLock { writeBlocked }

    /** The next write throws error instead of writing, as a socket reset under it does. */
    fun failNextWrite(error: IOException) {
        lock.withLock { failures.addLast(error) }
    }

    override fun read(buffer: ByteArray): Int {
        lock.lock()
        try {
            while (true) {
                if (isDestroyed) throw endRead(IOException("the channel was destroyed"))
                val chunk = chunks.firstOrNull()
                if (chunk != null) {
                    val count = minOf(buffer.size, chunk.size - chunkOffset)
                    System.arraycopy(chunk, chunkOffset, buffer, 0, count)
                    chunkOffset += count
                    if (chunkOffset == chunk.size) {
                        chunks.removeFirst()
                        chunkOffset = 0
                    }
                    return count
                }
                if (peerEnded) {
                    hubReadEnded = true
                    return -1
                }
                hubReading = true
                try {
                    changed.await()
                } catch (e: InterruptedException) {
                    Thread.currentThread().interrupt()
                    throw endRead(InterruptedIOException("the hub's reader was interrupted"))
                } finally {
                    hubReading = false
                }
            }
        } finally {
            lock.unlock()
        }
    }

    override fun write(bytes: ByteArray) {
        lock.withLock {
            while (held && !isDestroyed) {
                writeBlocked = true
                try {
                    changed.await()
                } catch (e: InterruptedException) {
                    // As an interruptible NIO channel does, the interrupt status stays set.
                    Thread.currentThread().interrupt()
                    throw InterruptedIOException("the hub's writer was interrupted")
                } finally {
                    writeBlocked = false
                }
            }
            failures.removeFirstOrNull()?.let { throw it }
            if (isOutputShutdown || isDestroyed || hubReadEnded) {
                writesAfterEnd++
                return
            }
            this.bytes.write(bytes)
            val text = this.bytes.toString(Charsets.UTF_8)
            val end = text.lastIndexOf('\n')
            if (end >= 0) {
                frames += text.substring(0, end).split('\n')
                val rest = text.substring(end + 1).toByteArray(Charsets.UTF_8)
                this.bytes.reset()
                this.bytes.write(rest)
            }
        }
    }

    override fun shutdownOutput() {
        lock.withLock { isOutputShutdown = true }
    }

    override fun destroy() {
        lock.withLock {
            isDestroyed = true
            changed.signalAll()
        }
    }

    /** The hub calls it once reading and writing both ended; it releases nothing a test looks at. */
    override fun close() {
        lock.withLock { closes++ }
    }

    private fun endRead(error: IOException): IOException {
        hubReadEnded = true
        return error
    }
}
