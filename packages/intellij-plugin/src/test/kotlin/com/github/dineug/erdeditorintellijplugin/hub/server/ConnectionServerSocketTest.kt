package com.github.dineug.erdeditorintellijplugin.hub.server

import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubMethod
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import com.github.dineug.erdeditorintellijplugin.hub.LockPaths
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingHandler
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestPeer
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import com.github.dineug.erdeditorintellijplugin.hub.transport.HubListener
import com.github.dineug.erdeditorintellijplugin.hub.transport.platformListenerFactory
import kotlinx.coroutines.CompletableDeferred
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * serveConnection behind the platform's real listener, a unix socket under /tmp or, on Windows, a
 * named pipe of its own: the bytes a peer such as the MCP server reads for a hello, a refused
 * hello, a request, pipelined batches, a hang-up after answers and the hub stopping.
 */
class ConnectionServerSocketTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    @get:Rule
    val testThreads = TestThreads()

    private val log = RecordingLog()
    private val handler = RecordingHandler()
    private val served = CopyOnWriteArrayList<ServedConnection>()
    private val peers = CopyOnWriteArrayList<TestPeer>()
    private var dir: Path? = null
    private lateinit var threads: HubThreads
    private lateinit var listener: HubListener

    @Before
    fun setUp() {
        threads = testThreads.create(log)
        val platform = HubPlatform.current()
        val pipe = if (platform.isWindows) {
            "\\\\.\\pipe\\erd-editor-ide-test-${UUID.randomUUID()}"
        } else {
            val temp = Files.createTempDirectory(Path.of("/tmp"), "erdh").also { dir = it }
            temp.resolve("hub.sock").toString().also { assertTrue("$it fits a socket address", LockPaths.pipePathFits(it, platform)) }
        }
        val ids = AtomicInteger()
        val options = ServeOptions(TOKEN, "intellij", "0.0.0-test", handler, { "/real$it" }, ids::incrementAndGet, threads, log)
        listener = platformListenerFactory(platform, threads.ioExecutor, log).listen(pipe) { channel ->
            serveConnection(channel, options).also(served::add).start()
        }
    }

    @After
    fun tearDown() {
        peers.forEach(TestPeer::close)
        if (::listener.isInitialized) listener.close()
        served.forEach(ServedConnection::destroyNow)
        served.forEach { it.finished.get(5, TimeUnit.SECONDS) }
        dir?.toFile()?.deleteRecursively()
    }

    private fun connect(reading: Boolean = true): TestPeer = TestPeer.connect(listener.pipe, reading).also(peers::add)

    private fun request(id: Int, method: String, params: String = "{}") =
        """{"id":$id,"method":"$method","params":$params}"""

    @Test
    fun `answers a hello carrying the lock token`() {
        val peer = connect()

        peer.send(hello())

        assertEquals(
            listOf("""{"id":1,"ok":true,"method":"hello","result":{"protocolVersion":1,"ide":"intellij","version":"0.0.0-test"}}"""),
            peer.receiveFrames(1),
        )
    }

    @Test
    fun `refuses a wrong token, then ends the stream`() {
        val peer = connect()

        peer.send(hello(TOKEN.replace('6', '7')))

        assertEquals(
            listOf(
                """{"id":1,"ok":false,"method":"hello","error":{"code":"unauthorized",""" +
                    """"message":"The hello token does not match the lock file of this window"}}""",
            ),
            peer.receiveFrames(1),
        )
        assertEquals(emptyList<String>(), peer.awaitEof())
    }

    @Test
    fun `routes listDocuments to the handler with the client name`() {
        val peer = connect()

        peer.send(hello(), request(2, "listDocuments"))

        assertEquals("""{"id":2,"ok":true,"method":"listDocuments","result":{"documents":[]}}""", peer.receiveFrames(2)[1])
        assertEquals("spec", handler.calls.single().connection.client)
    }

    @Test
    fun `holds the frames behind a batch until it is answered, and answers in order`() {
        val first = CompletableDeferred<Unit>()
        handler.answerOnce(HubMethod.APPLY_ACTIONS) { _, _ ->
            first.await()
            HandlerResult(HubResults.applyActions(1))
        }
        handler.answerOnce(HubMethod.APPLY_ACTIONS) { _, _ -> throw IllegalStateException("webview gone") }
        val peer = connect()

        peer.send(
            hello(),
            request(2, "applyActions", """{"path":"/a","actions":[1]}"""),
            request(3, "applyActions", """{"path":"/a","actions":[2]}"""),
            request(4, "listDocuments"),
        )
        peer.receiveFrames(1)
        awaitUntil(message = "batch 1 called") { handler.calls.size == 1 }
        first.complete(Unit)

        val ids = peer.receiveFrames(3).map { HubJson.parse(it).get("id").intValue() }
        assertEquals(listOf(2, 3, 4), ids)
        assertEquals(listOf(HubMethod.APPLY_ACTIONS, HubMethod.APPLY_ACTIONS, HubMethod.LIST_DOCUMENTS), handler.calls.map { it.method })
    }

    @Test
    fun `keeps the answers it wrote readable when it hangs up on a malformed line`() {
        val peer = connect(reading = false)
        peer.send(hello(), request(2, "listDocuments"), request(3, "leave", """{"path":"/a"}"""))
        awaitUntil(message = "both requests handled") { handler.calls.size == 2 }
        // Each answer is queued in its handler's registry step; the drain then waits until it is written.
        threads.callBlocking(5_000) {}
        handler.calls.last().connection.drain().get(5, TimeUnit.SECONDS)

        // A write of its own, with every answer still unread by the peer.
        peer.sendRaw("{\"id\":4,\n".toByteArray())
        served.single().finished.get(5, TimeUnit.SECONDS)
        peer.resume()

        assertEquals(listOf(1, 2, 3), peer.receiveFrames(3).map { HubJson.parse(it).get("id").intValue() })
        assertEquals(emptyList<String>(), peer.awaitEof())
        assertEquals(listOf("hung up on a peer that sent a malformed frame"), log.texts)
    }

    @Test
    fun `hangs up every peer when the hub stops, and serves nothing after`() {
        val authenticated = connect()
        authenticated.send(hello())
        authenticated.receiveFrames(1)
        val anonymous = connect()
        awaitUntil(message = "both accepted") { served.size == 2 }

        listener.close()
        served.forEach(ServedConnection::destroyNow)

        assertEquals(emptyList<String>(), authenticated.awaitEof())
        assertEquals(emptyList<String>(), anonymous.awaitEof())
        served.forEach { it.finished.get(5, TimeUnit.SECONDS) }
        awaitUntil(message = "the authenticated peer disconnected") { handler.disconnects.size == 1 }

        // Sent after the stop, whether the write fails or not: no connection is left to route it.
        runCatching { authenticated.send(request(2, "listDocuments")) }
        runCatching { anonymous.send(hello()) }
        assertThrows(IOException::class.java) { TestPeer.connect(listener.pipe, timeoutMs = 500) }
        assertEquals(emptyList<RecordingHandler.Call>(), handler.calls)
        assertEquals(1, handler.disconnects.size)
    }

    private companion object {
        const val TOKEN = "6f1c2e0a-8f7e-4d4c-9a51-3a8e2b1d0c9f"

        fun hello(token: String = TOKEN) =
            """{"id":1,"method":"hello","params":{"token":"$token","protocolVersion":1,"client":"spec"}}"""
    }
}
