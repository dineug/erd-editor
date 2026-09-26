package com.github.dineug.erdeditorintellijplugin.hub.transport

import com.fasterxml.jackson.databind.JsonNode
import com.github.dineug.erdeditorintellijplugin.hub.FrameDecoder
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.LockPaths
import com.github.dineug.erdeditorintellijplugin.hub.testing.AcceptedChannels
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestPeer
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import com.github.dineug.erdeditorintellijplugin.hub.testing.readLines
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeFalse
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.BindException
import java.net.StandardProtocolFamily
import java.net.UnixDomainSocketAddress
import java.nio.channels.ClosedByInterruptException
import java.nio.channels.ServerSocketChannel
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.util.concurrent.CancellationException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

/**
 * The unix socket listener and channel over real sockets under /tmp, as packages/agent-hub-host's
 * nodeHub and netSocket tests hold Node's: bytes both ways, a failed bind, a socket file the listener
 * leaves to the hub, backpressure, graceful and abrupt ends, and an accept loop that neither spins nor
 * outlives close: tearDown checks that close ended it, before shutdownNow could interrupt it.
 */
class UnixSocketTransportTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    private val prefix = "erd-editor-hub-uds-test-"
    private val threads = AtomicInteger()
    private val log = RecordingLog()
    private val uncaught = CopyOnWriteArrayList<Throwable>()
    private val executors = CopyOnWriteArrayList<ThreadPoolExecutor>()
    private val listeners = CopyOnWriteArrayList<HubListener>()
    private val peers = CopyOnWriteArrayList<TestPeer>()
    private lateinit var dir: Path
    private lateinit var io: ThreadPoolExecutor

    @Before
    fun setUp() {
        assumeFalse("the hub serves a unix socket on macOS and Linux only", HubPlatform.current().isWindows)
        dir = Files.createTempDirectory(Path.of("/tmp"), "erdh")
        io = executor()
    }

    @After
    fun tearDown() {
        if (!::dir.isInitialized) return
        peers.forEach(TestPeer::close)
        listeners.forEach(HubListener::close)
        try {
            assertAcceptWorkEnded()
        } finally {
            executors.forEach(ThreadPoolExecutor::shutdownNow)
            dir.toFile().deleteRecursively()
        }
        executors.forEach { assertTrue("the hub's threads end", it.awaitTermination(5, TimeUnit.SECONDS)) }
        awaitUntil(2_000, "no thread named $prefix* left") {
            Thread.getAllStackTraces().keys.none { it.isAlive && it.name.startsWith(prefix) }
        }
        assertEquals("nothing escapes a task", emptyList<Throwable>(), uncaught.toList())
    }

    /** A cached pool whose threads record what escapes a task, as an IDE's default handler would log it. */
    private fun executor(): ThreadPoolExecutor =
        ThreadPoolExecutor(0, Int.MAX_VALUE, 60, TimeUnit.SECONDS, SynchronousQueue()) { runnable ->
            Thread(runnable, "$prefix${threads.incrementAndGet()}").apply {
                isDaemon = true
                setUncaughtExceptionHandler { _, e -> uncaught += e }
            }
        }.also(executors::add)

    /**
     * No accept loop or serve task still runs within 500 ms: close ended them itself. tearDown's
     * shutdownNow would end a loop close missed too, by interrupting its accept.
     */
    private fun assertAcceptWorkEnded() {
        awaitUntil(500, "the accept work ended") { executors.all { it.activeCount == 0 } }
    }

    private fun socket(name: String = "hub.sock"): String = dir.resolve(name).toString().also {
        assertTrue("$it fits a socket address", LockPaths.pipePathFits(it, HubPlatform.current()))
    }

    private fun listen(
        pipe: String,
        onAccept: (HubChannel) -> Unit,
        factory: HubListenerFactory = UnixSocketListenerFactory(io, log),
    ): HubListener = factory.listen(pipe, onAccept).also(listeners::add)

    private fun connect(pipe: String, reading: Boolean = true): TestPeer =
        TestPeer.connect(pipe, reading).also(peers::add)

    private fun exists(pipe: String) = Files.exists(Path.of(pipe), LinkOption.NOFOLLOW_LINKS)

    /** A listener with its first peer and the hub's side of that peer. */
    private fun connected(reading: Boolean = true): Triple<HubListener, TestPeer, HubChannel> {
        val pipe = socket()
        val accepted = AcceptedChannels()
        val listener = listen(pipe, accepted)
        val peer = connect(pipe, reading)
        return Triple(listener, peer, accepted.take())
    }

    /** Runs block on a daemon thread; the latch opens once it returned or threw. */
    private fun background(block: () -> Unit): Pair<CountDownLatch, AtomicReference<Result<Unit>>> {
        val done = CountDownLatch(1)
        val outcome = AtomicReference<Result<Unit>>()
        thread(isDaemon = true) {
            outcome.set(runCatching(block))
            done.countDown()
        }
        return done to outcome
    }

    @Test
    fun `serves bytes both ways, with a character split across two writes decoded whole`() {
        val (_, peer, hub) = connected()
        val line = "\"한\"\n".toByteArray(Charsets.UTF_8)
        val decoder = FrameDecoder()
        val buffer = ByteArray(64)

        // The quote and the first byte of the character, alone in a read: nothing completes yet.
        peer.sendRaw(line.copyOfRange(0, 2))
        var received = 0
        while (received < 2) {
            val count = hub.read(buffer)
            assertEquals(emptyList<JsonNode>(), decoder.feed(buffer, 0, count))
            received += count
        }
        peer.sendRaw(line.copyOfRange(2, line.size))
        val values = mutableListOf<JsonNode>()
        while (values.isEmpty()) values += decoder.feed(buffer, 0, hub.read(buffer))
        assertEquals(listOf("한"), values.map(JsonNode::textValue))

        hub.write("ok\n".toByteArray())
        assertEquals(listOf("ok"), peer.receiveFrames(1))
        assertEquals(emptyList<String>(), peer.received())
        assertFalse(peer.isEnded)
    }

    @Test
    fun `carries a payload larger than one read without losing a character`() {
        val (_, peer, hub) = connected()
        val payload = "테이블".repeat(30_000)
        val bytes = "$payload\n".toByteArray(Charsets.UTF_8)

        val (sent, sending) = background { peer.sendRaw(bytes) }
        val received = ByteArrayOutputStream()
        val buffer = ByteArray(64 * 1024)
        var reads = 0
        while (received.size() < bytes.size) {
            val count = hub.read(buffer)
            assertTrue("no EOF before the whole payload", count > 0)
            received.write(buffer, 0, count)
            reads++
        }
        assertTrue(sent.await(5, TimeUnit.SECONDS))
        assertTrue(sending.get().isSuccess)
        assertTrue("the payload equals what was sent", bytes.contentEquals(received.toByteArray()))
        assertTrue("more than one read, $reads", reads > 1)

        hub.write(bytes)
        assertTrue("the peer reads it back whole", peer.receiveFrames(1).single() == payload)
    }

    @Test
    fun `hangs up every peer and ends its accept loop once closed, leaving the socket file to the hub`() {
        val pipe = socket()
        val accepted = AcceptedChannels()
        val listener = listen(pipe, accepted)
        val first = connect(pipe)
        val hubFirst = accepted.take()
        val second = connect(pipe)
        accepted.take()
        first.sendRaw("partial".toByteArray())
        assertEquals("partial", String(ByteArray(16).let { it.copyOf(hubFirst.read(it)) }))
        assertTrue(exists(pipe))

        assertFalse(first.isEnded)
        listener.close()
        assertAcceptWorkEnded()

        assertEquals(emptyList<String>(), first.awaitEof())
        assertEquals(emptyList<String>(), second.awaitEof())
        assertTrue(first.isEnded)
        assertThrows(IOException::class.java) { hubFirst.read(ByteArray(16)) }
        listener.close()
        // The JDK leaves a closed server's socket file, where Node's server unlinks it; the hub
        // deletes it after it stops. Nothing answers there meanwhile.
        assertTrue(exists(pipe))
        assertThrows(IOException::class.java) { TestPeer.connect(pipe) }
    }

    @Test
    fun `fails with the pipe it could not bind and leaves no file`() {
        val missing = dir.resolve("missing").resolve("hub.sock").toString()
        val error = assertThrows(HubListenException::class.java) { listen(missing, {}) }
        assertEquals(missing, error.pipe)
        assertTrue(error.cause is IOException)
        assertEquals(error.cause!!.message, error.message)
        assertFalse(exists(missing))
    }

    @Test
    fun `refuses a path a socket address cannot hold, which the hub never hands out`() {
        val long = dir.resolve("s".repeat(120) + ".sock").toString()
        assertFalse(LockPaths.pipePathFits(long, HubPlatform.current()))
        assertEquals(long, assertThrows(HubListenException::class.java) { listen(long, {}) }.pipe)
        assertFalse(exists(long))

        val nul = dir.resolve("a").toString() + "\u0000b.sock"
        assertEquals(nul, assertThrows(HubListenException::class.java) { listen(nul, {}) }.pipe)
    }

    @Test
    fun `refuses a pipe a file, a stale socket or a directory holds, and removes none of them`() {
        val pipe = socket()
        Files.writeString(Path.of(pipe), "stale")
        val held = assertThrows(HubListenException::class.java) { listen(pipe, {}) }
        assertEquals(pipe, held.pipe)
        assertTrue(held.cause is BindException)
        assertEquals("stale", Files.readString(Path.of(pipe)))

        // The JDK leaves a closed server's socket file behind, as a dead process leaves its own.
        Files.delete(Path.of(pipe))
        ServerSocketChannel.open(StandardProtocolFamily.UNIX).use { it.bind(UnixDomainSocketAddress.of(pipe)) }
        assertThrows(HubListenException::class.java) { listen(pipe, {}) }
        assertTrue(exists(pipe))

        // Once the hub deleted it, as it does before every listen, the bind succeeds.
        Files.delete(Path.of(pipe))
        val accepted = AcceptedChannels()
        listen(pipe, accepted)
        connect(pipe).send("after a stale socket")
        assertEquals(listOf("after a stale socket"), accepted.take().readLines(1))

        val folder = socket("folder.sock")
        Files.createDirectory(Path.of(folder))
        assertThrows(HubListenException::class.java) { listen(folder, {}) }
        assertTrue(Files.isDirectory(Path.of(folder)))
    }

    @Test
    fun `reads EOF at every read once the peer hung up, and drops later writes`() {
        val (_, peer, hub) = connected()
        peer.close()
        val buffer = ByteArray(16)
        assertEquals(-1, hub.read(buffer))
        assertEquals(-1, hub.read(buffer))
        // Node ends its side when the peer ends (allowHalfOpen false): the write goes nowhere.
        hub.write("dropped\n".toByteArray())
        hub.close()
    }

    @Test
    fun `drops a write to a channel it destroyed or ended, and refuses a read after destroy`() {
        val pipe = socket()
        val accepted = AcceptedChannels()
        listen(pipe, accepted)

        val destroyedPeer = connect(pipe)
        val destroyed = accepted.take()
        destroyed.destroy()
        destroyed.write("late\n".toByteArray())
        assertThrows(IOException::class.java) { destroyed.read(ByteArray(16)) }
        destroyed.shutdownOutput()
        destroyed.close()
        assertEquals(emptyList<String>(), destroyedPeer.awaitEof())

        val endedPeer = connect(pipe)
        val ended = accepted.take()
        ended.shutdownOutput()
        ended.write("late\n".toByteArray())
        assertEquals(emptyList<String>(), endedPeer.awaitEof())
        ended.close()
    }

    @Test
    fun `ends its output after the last write and keeps reading until the peer's EOF`() {
        val (_, peer, hub) = connected()
        hub.write("{\"id\":1,\"error\":{}}\n".toByteArray())
        hub.shutdownOutput()

        assertEquals(listOf("{\"id\":1,\"error\":{}}"), peer.awaitEof())
        peer.send("after the end")
        assertEquals(listOf("after the end"), hub.readLines(1))
        peer.shutdownOutput()
        assertEquals(-1, hub.read(ByteArray(16)))
        hub.close()
    }

    @Test
    fun `waits for a peer that does not read, and delivers everything once it does`() {
        val (_, peer, hub) = connected(reading = false)
        val payload = "x".repeat(4 * 1024 * 1024)

        val (written, writing) = background { hub.write("$payload\n".toByteArray()) }
        assertFalse("the write waits for the peer", written.await(200, TimeUnit.MILLISECONDS))
        peer.resume()
        assertTrue(written.await(10, TimeUnit.SECONDS))
        assertTrue(writing.get().isSuccess)
        assertTrue("the peer reads it whole", peer.receiveFrames(1).single() == payload)
    }

    @Test
    fun `drops the rest of a write it is destroyed during, and keeps what it wrote readable`() {
        val (_, peer, hub) = connected(reading = false)
        hub.write("one\ntwo\n".toByteArray())

        val (written, writing) = background { hub.write(ByteArray(4 * 1024 * 1024) { 'y'.code.toByte() }) }
        assertFalse("the write waits for the peer", written.await(200, TimeUnit.MILLISECONDS))
        hub.destroy()
        assertTrue(written.await(5, TimeUnit.SECONDS))
        assertTrue("a destroyed channel drops the write without a failure", writing.get().isSuccess)

        peer.resume()
        // The unterminated tail of the cut write is no frame.
        assertEquals(listOf("one", "two"), peer.awaitEof())
    }

    @Test
    fun `fails a write whose own thread is interrupted`() {
        val (_, _, hub) = connected(reading = false)
        val outcome = AtomicReference<Result<Unit>>()
        val writer = thread(isDaemon = true) {
            outcome.set(runCatching { hub.write(ByteArray(4 * 1024 * 1024)) })
        }
        writer.join(200)
        assertTrue("the write waits for the peer", writer.isAlive)
        writer.interrupt()
        writer.join(5_000)
        assertTrue(outcome.get().exceptionOrNull() is ClosedByInterruptException)
    }

    @Test
    fun `unblocks a read on the hub's side when destroyed`() {
        val (_, peer, hub) = connected()
        val (read, reading) = background { hub.read(ByteArray(16)) }
        assertFalse("the read waits for bytes", read.await(100, TimeUnit.MILLISECONDS))
        hub.destroy()
        assertTrue(read.await(5, TimeUnit.SECONDS))
        assertTrue(reading.get().exceptionOrNull() is IOException)
        assertEquals(emptyList<String>(), peer.awaitEof())
    }

    @Test
    fun `logs an accept failure and pauses before it accepts again`() {
        val pipe = socket()
        val attempts = CopyOnWriteArrayList<Long>()
        val failures = AtomicInteger(2)
        val failure = IOException("Too many open files")
        val factory = UnixSocketListenerFactory(io, log) { server ->
            attempts += System.nanoTime()
            if (failures.getAndDecrement() > 0) throw failure
            server.accept()
        }
        val accepted = AcceptedChannels()
        listen(pipe, accepted, factory)

        connect(pipe).send("served after the failures")
        assertEquals(listOf("served after the failures"), accepted.take().readLines(1))
        assertEquals(listOf("" to failure, "" to failure), log.lines)
        val pauses = attempts.take(3).zipWithNext { before, after -> TimeUnit.NANOSECONDS.toMillis(after - before) }
        assertTrue("each failure pauses about 100 ms: $pauses", pauses.size == 2 && pauses.all { it >= 90 })
    }

    @Test
    fun `stops at once when closed while it pauses after a failure`() {
        val factory = UnixSocketListenerFactory(io, log) { throw IOException("Too many open files") }
        val listener = listen(socket(), {}, factory)
        awaitUntil(2_000, "a failure logged") { log.lines.isNotEmpty() }

        // close waits up to 500 ms for the loop, so returning sooner means the pause ended the loop.
        val started = System.nanoTime()
        listener.close()
        val took = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started)
        assertTrue("close ends the pause, $took ms", took < 400)
    }

    @Test
    fun `logs nothing for an accept that fails because it was closed`() {
        val factory = UnixSocketListenerFactory(io, log) { server ->
            awaitUntil(5_000, "the server closed") { !server.isOpen }
            throw IOException("closed underneath the accept")
        }
        listen(socket(), {}, factory).close()
        assertEquals(emptyList<Pair<String, Any?>>(), log.lines)
    }

    @Test
    fun `hangs up a peer accepted while it closes`() {
        val side = socket("side.sock")
        ServerSocketChannel.open(StandardProtocolFamily.UNIX).use { sideServer ->
            sideServer.bind(UnixDomainSocketAddress.of(side))
            val peer = connect(side)
            val sideSocket = sideServer.accept()
            val handed = AtomicBoolean()
            val factory = UnixSocketListenerFactory(io, log) { server ->
                if (handed.getAndSet(true)) return@UnixSocketListenerFactory server.accept()
                awaitUntil(5_000, "the server closed") { !server.isOpen }
                sideSocket
            }
            val accepted = AcceptedChannels()
            listen(socket(), accepted, factory).close()

            assertEquals(emptyList<String>(), peer.awaitEof())
            assertTrue(accepted.isEmpty())
        }
    }

    @Test
    fun `hangs up a peer it cannot hand to threads that stopped`() {
        val stopping = executor()
        val pipe = socket()
        val accepted = AcceptedChannels()
        listen(pipe, accepted, UnixSocketListenerFactory(stopping, log))
        // The running accept loop goes on; new work is refused.
        stopping.shutdown()

        assertEquals(emptyList<String>(), connect(pipe).awaitEof())
        assertTrue(accepted.isEmpty())
    }

    @Test
    fun `fails to listen on threads that stopped, and serves nothing`() {
        val stopped = executor().apply { shutdown() }
        val pipe = socket()
        val error = assertThrows(HubListenException::class.java) {
            UnixSocketListenerFactory(stopped, log).listen(pipe) {}
        }
        assertEquals(pipe, error.pipe)
        assertTrue(error.cause is RejectedExecutionException)
        assertThrows(IOException::class.java) { TestPeer.connect(pipe) }
    }

    @Test
    fun `hangs up a peer whose serving was cancelled, and logs nothing`() {
        val pipe = socket()
        listen(pipe, { throw CancellationException("the hub is stopping") })

        assertEquals(emptyList<String>(), connect(pipe).awaitEof())
        assertEquals(emptyList<Pair<String, Any?>>(), log.lines)
    }

    @Test
    fun `hangs up a peer whose serving could not start, and logs why`() {
        val pipe = socket()
        val failure = IllegalStateException("serving could not start")
        listen(pipe, { throw failure })

        assertEquals(emptyList<String>(), connect(pipe).awaitEof())
        assertEquals(1, log.lines.size)
        assertEquals("", log.lines.single().first)
        assertSame(failure, log.lines.single().second)
    }

    @Test
    fun `ends its accept loop when the hub's threads stop during a pause`() {
        val stopping = executor()
        val factory = UnixSocketListenerFactory(stopping, log) { throw IOException("Too many open files") }
        val listener = listen(socket(), {}, factory)
        awaitUntil(2_000, "a failure logged") { log.lines.isNotEmpty() }

        stopping.shutdownNow()
        assertTrue(stopping.awaitTermination(5, TimeUnit.SECONDS))
        val started = System.nanoTime()
        listener.close()
        assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started) < 400)
    }

    @Test
    fun `keeps the interrupt of a thread that closes it`() {
        val pipe = socket()
        val listener = listen(pipe, {})
        Thread.currentThread().interrupt()
        try {
            listener.close()
        } finally {
            assertTrue("the interrupt survives close", Thread.interrupted())
        }
        assertThrows(IOException::class.java) { TestPeer.connect(pipe) }
    }
}
