package com.github.dineug.erdeditorintellijplugin.hub.transport

import com.fasterxml.jackson.databind.JsonNode
import com.github.dineug.erdeditorintellijplugin.hub.FrameDecoder
import com.github.dineug.erdeditorintellijplugin.hub.FrameException
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.encodeFrame
import com.github.dineug.erdeditorintellijplugin.hub.testing.AcceptedChannels
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestPeer
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import com.github.dineug.erdeditorintellijplugin.hub.testing.readLines
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.UUID
import java.util.concurrent.CancellationException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

/**
 * The named-pipe listener and channel over real pipes, Windows only (NP-1 to NP-10): the transport
 * Node's net.connect dials there. Every pipe is erd-editor-ide-test-<uuid>, never a pid's name.
 * Nothing here runs on macOS or Linux, where it compiles and skips; CI's Windows job runs it.
 * tearDown checks that close ended the accept work, before shutdownNow could interrupt it.
 */
class NamedPipeTransportTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    private val prefix = "erd-editor-hub-pipe-test-"
    private val threads = AtomicInteger()
    private val log = RecordingLog()
    private val uncaught = CopyOnWriteArrayList<Throwable>()
    private val listeners = CopyOnWriteArrayList<HubListener>()
    private val peers = CopyOnWriteArrayList<TestPeer>()
    private lateinit var io: ThreadPoolExecutor

    @Before
    fun setUp() {
        assumeTrue("the hub serves a named pipe on Windows only", HubPlatform.current().isWindows)
        // A cached pool whose threads record what escapes a task, as an IDE's default handler would log it.
        io = ThreadPoolExecutor(0, Int.MAX_VALUE, 60, TimeUnit.SECONDS, SynchronousQueue()) { runnable ->
            Thread(runnable, "$prefix${threads.incrementAndGet()}").apply {
                isDaemon = true
                setUncaughtExceptionHandler { _, e -> uncaught += e }
            }
        }
    }

    @After
    fun tearDown() {
        if (!::io.isInitialized) return
        peers.forEach(TestPeer::close)
        listeners.forEach(HubListener::close)
        try {
            assertAcceptWorkEnded()
        } finally {
            io.shutdownNow()
        }
        assertTrue("the hub's threads end", io.awaitTermination(5, TimeUnit.SECONDS))
        awaitUntil(2_000, "no thread named $prefix* left") {
            Thread.getAllStackTraces().keys.none { it.isAlive && it.name.startsWith(prefix) }
        }
        assertEquals("nothing escapes a task", emptyList<Throwable>(), uncaught.toList())
    }

    /** No accept loop or serve task still runs within 500 ms: close ended them itself. */
    private fun assertAcceptWorkEnded() {
        awaitUntil(500, "the accept work ended") { io.activeCount == 0 }
    }

    private fun pipeName(): String = "\\\\.\\pipe\\erd-editor-ide-test-${UUID.randomUUID()}"

    private fun listen(pipe: String, onAccept: (HubChannel) -> Unit): HubListener =
        NamedPipeListenerFactory(io, log).listen(pipe, onAccept).also(listeners::add)

    private fun connect(pipe: String, reading: Boolean = true): TestPeer =
        TestPeer.connect(pipe, reading).also(peers::add)

    private fun connected(reading: Boolean = true): Triple<HubListener, TestPeer, HubChannel> {
        val pipe = pipeName()
        val accepted = AcceptedChannels()
        val listener = listen(pipe, accepted)
        val peer = connect(pipe, reading)
        return Triple(listener, peer, accepted.take())
    }

    private fun background(block: () -> Unit): Pair<CountDownLatch, AtomicReference<Result<Unit>>> {
        val done = CountDownLatch(1)
        val outcome = AtomicReference<Result<Unit>>()
        thread(isDaemon = true) {
            outcome.set(runCatching(block))
            done.countDown()
        }
        return done to outcome
    }

    private fun millisSince(started: Long): Long = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started)

    // NP-1
    @Test
    fun `serves a line each way on a pipe of its own name`() {
        val (_, peer, hub) = connected()
        peer.send("{\"id\":1,\"method\":\"hello\"}")
        assertEquals(listOf("{\"id\":1,\"method\":\"hello\"}"), hub.readLines(1))
        hub.write("{\"id\":1,\"result\":{}}\n".toByteArray())
        assertEquals(listOf("{\"id\":1,\"result\":{}}"), peer.receiveFrames(1))
        assertEquals(emptyList<Pair<String, Any?>>(), log.lines)
    }

    // NP-2
    @Test
    fun `refuses a second listener on a name one already holds, and frees the name on close`() {
        val pipe = pipeName()
        val first = listen(pipe, {})
        val error = assertThrows(HubListenException::class.java) { listen(pipe, {}) }
        assertEquals(pipe, error.pipe)

        first.close()
        val accepted = AcceptedChannels()
        listen(pipe, accepted)
        connect(pipe).send("again")
        assertEquals(listOf("again"), accepted.take().readLines(1))
    }

    // NP-3
    @Test
    fun `serves three peers that connect at once`() {
        val pipe = pipeName()
        val accepted = AcceptedChannels()
        listen(pipe, accepted)
        val barrier = CyclicBarrier(3)
        val connecting = (1..3).map { index ->
            background {
                barrier.await()
                connect(pipe).send("peer $index")
            }
        }
        connecting.forEach { (done, outcome) ->
            assertTrue(done.await(10, TimeUnit.SECONDS))
            outcome.get().getOrThrow()
        }

        val lines = List(3) {
            val hub = accepted.take()
            hub.readLines(1).single().also { hub.write("$it\n".toByteArray()) }
        }
        assertEquals(setOf("peer 1", "peer 2", "peer 3"), lines.toSet())
        for (peer in peers) assertTrue(peer.receiveFrames(1).single() in lines)
    }

    // NP-4
    @Test
    fun `carries a character split across two writes and a payload larger than the pipe buffer`() {
        val (_, peer, hub) = connected()
        val line = "\"한\"\n".toByteArray(Charsets.UTF_8)
        val decoder = FrameDecoder()
        val buffer = ByteArray(64 * 1024)
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

        val payload = "테이블".repeat(30_000)
        val bytes = "$payload\n".toByteArray(Charsets.UTF_8)
        val (sent, sending) = background { peer.sendRaw(bytes) }
        val whole = ByteArrayOutputStream()
        var reads = 0
        while (whole.size() < bytes.size) {
            val count = hub.read(buffer)
            assertTrue("no EOF before the whole payload", count > 0)
            whole.write(buffer, 0, count)
            reads++
        }
        assertTrue(sent.await(10, TimeUnit.SECONDS))
        assertTrue(sending.get().isSuccess)
        assertTrue("the payload equals what was sent", bytes.contentEquals(whole.toByteArray()))
        assertTrue("more than one read, $reads", reads > 1)
        hub.write(bytes)
        assertTrue("the peer reads it back whole", peer.receiveFrames(1).single() == payload)
    }

    // NP-5
    @Test
    fun `hangs up every peer and ends its accept work within half a second once closed`() {
        val pipe = pipeName()
        val accepted = AcceptedChannels()
        val listener = listen(pipe, accepted)
        val first = connect(pipe)
        val hubFirst = accepted.take()
        val second = connect(pipe)
        accepted.take()
        first.sendRaw("partial".toByteArray())
        assertEquals("partial", String(ByteArray(16).let { it.copyOf(hubFirst.read(it)) }))

        val started = System.nanoTime()
        listener.close()
        val took = millisSince(started)
        assertTrue("close took $took ms", took < 1_000)
        assertAcceptWorkEnded()

        assertEquals(emptyList<String>(), first.awaitEof())
        assertEquals(emptyList<String>(), second.awaitEof())
        assertThrows(IOException::class.java) { hubFirst.read(ByteArray(16)) }
        // No instance waits any more, so no peer connects. The name itself lives on while first and
        // second hold their ends, so the connect may fail as busy rather than missing.
        assertThrows(IOException::class.java) { TestPeer.connect(pipe, timeoutMs = 200) }
        listener.close()
    }

    // NP-6
    @Test
    fun `reads EOF at every read once the peer closed its end`() {
        val (_, peer, hub) = connected()
        peer.close()
        val buffer = ByteArray(16)
        assertEquals(-1, hub.read(buffer))
        assertEquals(-1, hub.read(buffer))
        hub.write("dropped\n".toByteArray())
        hub.close()
    }

    // NP-7
    @Test
    fun `ends its output after one frame so the peer reads the frame, then EOF`() {
        val (_, peer, hub) = connected(reading = false)
        hub.write("{\"id\":1,\"error\":{\"code\":\"unauthorized\"}}\n".toByteArray())
        hub.shutdownOutput()
        hub.write("dropped\n".toByteArray())

        peer.resume()
        assertEquals(listOf("{\"id\":1,\"error\":{\"code\":\"unauthorized\"}}"), peer.awaitEof())
        assertNull("a clean EOF, not a failure", peer.endCause)
        hub.close()
    }

    // NP-8
    @Test
    fun `delivers 200 frames of 64 KiB in order to a peer that reads late`() {
        val (_, peer, hub) = connected(reading = false)
        val pad = "x".repeat(64 * 1024 - 32)
        val frames = List(200) { index -> "{\"i\":$index,\"pad\":\"$pad\"}" }

        val (written, writing) = background { frames.forEach { hub.write("$it\n".toByteArray()) } }
        assertFalse("the writes wait for the peer", written.await(300, TimeUnit.MILLISECONDS))
        peer.resume()
        assertTrue(written.await(10, TimeUnit.SECONDS))
        assertTrue(writing.get().isSuccess)

        val received = peer.receiveFrames(200, 10_000)
        assertEquals(frames.indices.toList(), received.map { HubJson.parse(it)["i"].asInt() })
        assertTrue("every frame arrives whole", received == frames)
    }

    // NP-9: serveConnection's hang-up, as a transport sees it; ConnectionServerSocketTest runs the real one.
    @Test
    fun `keeps the answers it wrote readable after it hangs up on a malformed line`() {
        val pipe = pipeName()
        val answered = CountDownLatch(2)
        val hungUp = CountDownLatch(1)
        listen(pipe) { channel -> answerUntilMalformed(channel, answered, hungUp) }
        val peer = connect(pipe, reading = false)

        peer.send("{\"id\":1,\"method\":\"listDocuments\"}", "{\"id\":2,\"method\":\"listDocuments\"}")
        assertTrue(answered.await(5, TimeUnit.SECONDS))
        // A separate write after both answers: a chunk holding a refused line yields nothing at all.
        peer.sendRaw("not json\n".toByteArray())
        assertTrue(hungUp.await(5, TimeUnit.SECONDS))

        peer.resume()
        assertEquals(listOf("{\"id\":1,\"result\":{}}", "{\"id\":2,\"result\":{}}"), peer.receiveFrames(2))
        assertEquals(emptyList<String>(), peer.awaitEof())
    }

    private fun answerUntilMalformed(channel: HubChannel, answered: CountDownLatch, hungUp: CountDownLatch) {
        val decoder = FrameDecoder()
        val buffer = ByteArray(64 * 1024)
        while (true) {
            val count = try {
                channel.read(buffer)
            } catch (e: IOException) {
                return
            }
            if (count < 0) return
            val requests = try {
                decoder.feed(buffer, 0, count)
            } catch (e: FrameException) {
                channel.destroy()
                hungUp.countDown()
                return
            }
            for (request in requests) {
                channel.write(encodeFrame("{\"id\":${HubJson.numberText(request["id"])},\"result\":{}}"))
                answered.countDown()
            }
        }
    }

    // NP-10
    @Test
    fun `ends and closes within their bounds while a peer never reads`() {
        val (listener, _, hub) = connected(reading = false)
        val (written, writing) = background { hub.write(ByteArray(1024 * 1024) { 'z'.code.toByte() }) }
        assertFalse("the write waits for the peer", written.await(300, TimeUnit.MILLISECONDS))

        val ending = System.nanoTime()
        hub.shutdownOutput()
        val ended = millisSince(ending)
        assertTrue("shutdownOutput took $ended ms", ended < 1_500)
        assertTrue(written.await(1_500, TimeUnit.MILLISECONDS))
        assertTrue("the cancelled write drops the rest without a failure", writing.get().isSuccess)

        val closing = System.nanoTime()
        listener.close()
        val closed = millisSince(closing)
        assertTrue("close took $closed ms", closed < 1_500)
        assertAcceptWorkEnded()
    }

    @Test
    fun `hangs up a peer whose serving was cancelled, and logs nothing`() {
        val pipe = pipeName()
        listen(pipe, { throw CancellationException("the hub is stopping") })

        assertEquals(emptyList<String>(), connect(pipe).awaitEof())
        assertEquals(emptyList<Pair<String, Any?>>(), log.lines)
    }
}
