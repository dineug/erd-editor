package com.github.dineug.erdeditorintellijplugin.hub.server

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.AuthScope
import com.github.dineug.erdeditorintellijplugin.hub.Authz
import com.github.dineug.erdeditorintellijplugin.hub.HubErrorCode
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubMethod
import com.github.dineug.erdeditorintellijplugin.hub.HubRequestError
import com.github.dineug.erdeditorintellijplugin.hub.MAX_FRAME_BYTES
import com.github.dineug.erdeditorintellijplugin.hub.server.ConnectionScenarioTest.Companion.awaitIdle
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeOp
import com.github.dineug.erdeditorintellijplugin.hub.testing.MemoryChannel
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingHandler
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import kotlinx.coroutines.CompletableDeferred
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.io.IOException
import java.util.concurrent.CancellationException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

/**
 * serveConnection over a MemoryChannel, for what the corpus scenarios normalize away or cannot say:
 * the params a handler gets, a log's detail, timing, a second peer, a failing write, a thrown
 * defect, notify and drain, the ends of a connection, and the orderings the TypeScript server keeps
 * on one thread and this one keeps across five (per-connection lock, registry FIFO).
 */
class ConnectionServerTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(60)

    @get:Rule
    val testThreads = TestThreads()

    private val log = RecordingLog()
    private val handler = RecordingHandler()
    private val authorized = CopyOnWriteArrayList<String>()
    private val served = CopyOnWriteArrayList<ServedConnection>()
    private val ids = AtomicInteger()
    private val threads by lazy { testThreads.create(log) }

    @Volatile
    private var authorize: (String) -> String = { path -> "/real$path" }

    @After
    fun tearDown() {
        served.forEach(ServedConnection::destroyNow)
        served.forEach { it.finished.get(5, TimeUnit.SECONDS) }
    }

    /** One end of a served connection: what the peer sends, and the frames it has not looked at yet. */
    private inner class Client(val channel: MemoryChannel, val connection: ServedConnection) {
        private var seen = 0

        fun send(vararg frames: String) = channel.send(*frames)

        fun settle() = awaitIdle(channel, connection)

        /** The frames written since the last call, parsed. */
        fun fresh(): List<JsonNode> {
            val all = channel.received
            return all.drop(seen).also { seen = all.size }.map(HubJson::parse)
        }

        /** Waits for count more frames, then takes them. */
        fun next(count: Int): List<JsonNode> {
            awaitUntil(message = "$count more frames") { channel.received.size >= seen + count }
            return fresh()
        }
    }

    private fun connect(): Client {
        val options = ServeOptions(
            TOKEN, "vscode", "2.9.0", handler,
            { path -> authorized += path; authorize(path) },
            ids::incrementAndGet, threads, log,
        )
        val channel = MemoryChannel()
        val connection = serveConnection(channel, options).also(served::add)
        connection.start()
        return Client(channel, connection)
    }

    /** A connection whose hello passed; its answer is taken. */
    private fun connectAuthenticated(): Client = connect().apply {
        send(hello())
        next(1)
    }

    /** The HubConnection the hub hands handlers, got through a listDocuments. */
    private fun peerOf(client: Client): HubConnection {
        val before = handler.callsOf(HubMethod.LIST_DOCUMENTS).size
        client.send("""{"id":99,"method":"listDocuments","params":{}}""")
        client.next(1)
        return handler.callsOf(HubMethod.LIST_DOCUMENTS)[before].connection
    }

    private fun request(id: Int, method: String, params: String = "{}") =
        """{"id":$id,"method":"$method","params":$params}"""

    @Test
    fun `numbers the peers in the order their hello passed, skipping refused ones`() {
        val refused = connect()
        refused.send(hello(token = "wrong"))
        refused.settle()
        val first = connectAuthenticated()
        val second = connectAuthenticated()

        assertEquals(1, peerOf(first).id)
        assertEquals(2, peerOf(second).id)
        assertEquals("spec", peerOf(first).client)
    }

    @Test
    fun `hands listDocuments the params object the peer sent, and an empty one for none`() {
        val client = connectAuthenticated()

        client.send(request(2, "listDocuments", """{"filter":"a","n":1}"""), """{"id":3,"method":"listDocuments"}""")
        client.next(2)

        val params = handler.callsOf(HubMethod.LIST_DOCUMENTS).map { HubJson.stringify(it.params as ObjectNode) }
        assertEquals(listOf("""{"filter":"a","n":1}""", "{}"), params)
    }

    @Test
    fun `reads create by truthiness and takes an initial value only as a string`() {
        val client = connectAuthenticated()
        val creates = listOf("1", "\"\"", "{}", "[]", "0.0", "false", "\"no\"")

        creates.forEachIndexed { index, create ->
            client.send(request(index + 2, "openDocument", """{"path":"/ws/$index.erd","create":$create,"initialValue":{}}"""))
        }
        client.next(creates.size)

        val opened = handler.callsOf(HubMethod.OPEN_DOCUMENT).map { it.params as OpenParams }
        assertEquals(listOf(true, false, true, true, false, false, true), opened.map { it.create })
        assertTrue(opened.all { it.initialValue == null })
        assertEquals((creates.indices).map { "/real/ws/$it.erd" }, opened.map { it.path })
    }

    @Test
    fun `logs every error code it answers with, with the error it answered`() {
        val client = connectAuthenticated()

        client.send(request(2, "rejoin"))
        client.next(1)

        val (text, detail) = log.lines.single()
        assertEquals("answered rejoin with badRequest", text)
        assertEquals(
            """{"code":"badRequest","message":"The hub has no method \"rejoin\""}""",
            HubJson.stringify(detail as JsonNode),
        )
    }

    @Test
    fun `answers a handler bug with internal, as JavaScript prints the error, and logs it`() {
        val bug = IllegalStateException("document is undefined")
        val bare = IllegalStateException()
        val anonymous = object : IllegalArgumentException("thrown by an anonymous class") {}
        handler.answerOnce(HubMethod.SAVE) { _, _ -> throw bug }
        handler.answerOnce(HubMethod.LEAVE) { _, _ -> throw bare }
        handler.answerOnce(HubMethod.JOIN) { _, _ -> throw anonymous }
        val client = connectAuthenticated()

        client.send(
            request(2, "save", """{"path":"/a"}"""),
            request(3, "leave", """{"path":"/a"}"""),
            request(4, "join", """{"path":"/a"}"""),
        )
        val answers = client.next(3).associate { it.get("id").intValue() to it.get("error") }

        assertEquals("""{"code":"internal","message":"IllegalStateException: document is undefined"}""", HubJson.stringify(answers.getValue(2)))
        assertEquals("""{"code":"internal","message":"IllegalStateException"}""", HubJson.stringify(answers.getValue(3)))
        assertEquals("${anonymous.javaClass.name}: thrown by an anonymous class", answers.getValue(4).get("message").textValue())
        assertEquals(listOf<Any?>(bug, bare, anonymous), log.lines.filter { it.first == "request failed" }.map { it.second })
    }

    @Test
    fun `carries the code and message of a handler's refusal`() {
        handler.answerOnce(HubMethod.SAVE) { _, _ -> throw HubRequestError(HubErrorCode.NOT_OPEN, "no webview is ready") }
        val client = connectAuthenticated()

        client.send(request(2, "save", """{"path":"/a"}"""))

        assertEquals(
            """{"id":2,"ok":false,"method":"save","error":{"code":"notOpen","message":"no webview is ready"}}""",
            HubJson.stringify(client.next(1).single()),
        )
        assertEquals(listOf("answered save with notOpen"), log.texts)
    }

    @Test
    fun `answers internal without an answered line when a result has no JSON form or is too deep`() {
        handler.answerOnce(HubMethod.LIST_DOCUMENTS) { _, _ ->
            HandlerResult(HubResults.listDocuments(emptyList()).also { it.set<JsonNode>("x", HubJson.nodes.pojoNode(Any())) })
        }
        handler.answerOnce(HubMethod.LEAVE) { _, _ ->
            var nested: JsonNode = HubJson.nodes.arrayNode()
            repeat(200_000) { nested = HubJson.nodes.arrayNode().add(nested) }
            HandlerResult(HubJson.nodes.objectNode().set("deep", nested))
        }
        val client = connectAuthenticated()

        client.send(request(2, "listDocuments"), request(3, "leave", """{"path":"/a"}"""))
        val answers = client.next(2).associate { it.get("id").intValue() to HubJson.stringify(it.get("error")) }

        assertEquals("""{"code":"internal","message":"IllegalArgumentException: A POJO node has no JSON form"}""", answers[2])
        assertEquals("""{"code":"internal","message":"StackOverflowError"}""", answers[3])
        assertEquals(listOf("request failed", "request failed"), log.texts)
        assertTrue(log.lines[1].second is StackOverflowError)
    }

    @Test
    fun `answers internal when a result is larger than a frame may be`() {
        handler.answerOnce(HubMethod.JOIN) { _, _ -> HandlerResult(HubResults.join("a".repeat(MAX_FRAME_BYTES), 0.0, false)) }
        val client = connectAuthenticated()

        client.send(request(2, "join", """{"path":"/a"}"""))
        val error = client.next(1).single().get("error")

        assertEquals("internal", error.get("code").textValue())
        val bytes = """{"id":2,"ok":true,"method":"join","result":{"initialValue":"","snapshotVersion":0,"readonly":false}}""".length +
            MAX_FRAME_BYTES
        assertEquals("FrameTooLargeException: A frame of $bytes bytes exceeds the 67108864 byte limit", error.get("message").textValue())
        assertEquals(listOf("request failed"), log.texts)
    }

    @Test
    fun `keeps later frames moving while a slow request is pending, and calls handlers in order`() {
        val release = CompletableDeferred<Unit>()
        handler.answerOnce(HubMethod.OPEN_DOCUMENT) { params, _ ->
            release.await()
            HandlerResult(HubResults.openDocument((params as OpenParams).path, true, 1))
        }
        val client = connectAuthenticated()

        client.send(request(2, "openDocument", """{"path":"/a"}"""), request(3, "listDocuments"))
        assertEquals(listOf(3), client.next(1).map { it.get("id").intValue() })
        assertEquals(listOf(HubMethod.OPEN_DOCUMENT, HubMethod.LIST_DOCUMENTS), handler.calls.map { it.method })

        release.complete(Unit)
        val opened = client.next(1).single()
        assertEquals("""{"path":"/real/a","opened":true,"webviews":1}""", HubJson.stringify(opened.get("result")))
    }

    @Test
    fun `starts each handler in frame order, so a join's first step runs before a batch behind it`() {
        val steps = CopyOnWriteArrayList<String>()
        val release = CompletableDeferred<Unit>()
        handler.answerOnce(HubMethod.JOIN) { _, _ ->
            steps += "join registered"
            release.await()
            HandlerResult(HubResults.join("{}", 0.0, false))
        }
        handler.answerOnce(HubMethod.APPLY_ACTIONS) { _, _ ->
            steps += "batch applied"
            HandlerResult(HubResults.applyActions(1))
        }
        val client = connectAuthenticated()

        client.send(request(2, "join", """{"path":"/a"}"""), request(3, "applyActions", """{"path":"/a","actions":[]}"""))

        assertEquals(listOf(3), client.next(1).map { it.get("id").intValue() })
        assertEquals(listOf("join registered", "batch applied"), steps)
        release.complete(Unit)
        assertEquals(listOf(2), client.next(1).map { it.get("id").intValue() })
    }

    @Test
    fun `runs a result's follow-up on the registry thread right after its answer was queued`() {
        val followUp = CompletableFuture<String>()
        handler.answerOnce(HubMethod.JOIN) { _, connection ->
            HandlerResult(HubResults.join("{}", 3.0, false)) {
                connection.notify(HubNotification.DocumentClosed("/real/a"))
                followUp.complete(Thread.currentThread().name)
            }
        }
        val client = connectAuthenticated()

        client.send(request(2, "join", """{"path":"/a"}"""))

        assertEquals(
            listOf(
                """{"id":2,"ok":true,"method":"join","result":{"initialValue":"{}","snapshotVersion":3,"readonly":false}}""",
                """{"method":"documentClosed","params":{"path":"/real/a"}}""",
            ),
            client.next(2).map(HubJson::stringify),
        )
        assertTrue(followUp.get(5, TimeUnit.SECONDS).startsWith("${threads.namePrefix}-registry"))
    }

    @Test
    fun `answers a refusal of its own after the answer of a handler started before it`() {
        val client = connectAuthenticated()
        val frames = (0 until 20).flatMap { round ->
            listOf(request(2 + round * 2, "join", """{"path":"/a"}"""), request(3 + round * 2, "rejoin"))
        }

        client.send(*frames.toTypedArray())

        assertEquals((2 until 42).toList(), client.next(40).map { it.get("id").intValue() })
    }

    @Test
    fun `holds the frames behind a batch until the batch is answered, success or failure`() {
        val first = CompletableDeferred<Unit>()
        handler.answerOnce(HubMethod.APPLY_ACTIONS) { _, _ ->
            first.await()
            HandlerResult(HubResults.applyActions(1))
        }
        handler.answerOnce(HubMethod.APPLY_ACTIONS) { _, _ -> throw IllegalStateException("webview gone") }
        val client = connectAuthenticated()

        client.send(
            request(2, "applyActions", """{"path":"/a","actions":[1]}"""),
            request(3, "applyActions", """{"path":"/a","actions":[2]}"""),
            request(4, "listDocuments"),
        )
        awaitUntil(message = "batch 1 called") { handler.calls.size == 1 }
        Thread.sleep(50)
        assertEquals(1, handler.calls.size)
        assertEquals(emptyList<JsonNode>(), client.fresh())

        first.complete(Unit)
        val answers = client.next(3)
        assertEquals(listOf("[1]", "[2]"), handler.callsOf(HubMethod.APPLY_ACTIONS).map { HubJson.stringify((it.params as ApplyParams).actions) })
        assertEquals(
            listOf(
                """{"id":2,"ok":true,"method":"applyActions","result":{"webviews":1}}""",
                """{"id":3,"ok":false,"method":"applyActions","error":{"code":"internal","message":"IllegalStateException: webview gone"}}""",
                """{"id":4,"ok":true,"method":"listDocuments","result":{"documents":[]}}""",
            ),
            answers.map(HubJson::stringify),
        )
    }

    @Test
    fun `keeps several batches in their order while authorization is slow, and authorizes in arrival order`() {
        val slow = CountDownLatch(1)
        val first = AtomicInteger()
        authorize = { path ->
            if (first.getAndIncrement() == 0) slow.await(5, TimeUnit.SECONDS)
            "/real$path"
        }
        val client = connectAuthenticated()

        client.send(
            request(2, "applyActions", """{"path":"/a","actions":[1]}"""),
            request(3, "applyActions", """{"path":"/b","actions":[2]}"""),
        )
        awaitUntil(message = "the first authorization entered") { authorized.size == 1 }
        slow.countDown()
        client.next(2)

        assertEquals(listOf("/a", "/b"), authorized)
        assertEquals(listOf("[1]", "[2]"), handler.calls.map { HubJson.stringify((it.params as ApplyParams).actions) })
    }

    @Test
    fun `logs a handler that throws, answers internal and keeps the connection`() {
        val bug = IllegalStateException("registry bug")
        handler.answerOnce(HubMethod.APPLY_ACTIONS) { _, _ -> throw bug }
        val client = connectAuthenticated()

        client.send(request(2, "applyActions", """{"path":"/a","actions":[]}"""), request(3, "listDocuments"))
        val answers = client.next(2)

        assertEquals("internal", answers[0].get("error").get("code").textValue())
        assertTrue(answers[1].get("ok").booleanValue())
        assertEquals(listOf("request failed" to bug), log.lines.take(1))
        assertFalse(client.channel.isDestroyed || client.channel.isOutputShutdown)
    }

    @Test
    fun `never logs a handler that stops by cancellation, and serves the next request`() {
        handler.answerOnce(HubMethod.SAVE) { _, _ -> throw CancellationException("the registry stopped") }
        val client = connectAuthenticated()

        client.send(request(2, "save", """{"path":"/a"}"""), request(3, "listDocuments"))

        assertEquals(listOf(3), client.next(1).map { it.get("id").intValue() })
        client.settle()
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `refuses every routed path outside the scope without a handler call or a file written`() {
        val env = FakeEnvironment().apply { fs.addDir("/ws") }
        val authz = Authz(env)
        authorize = { path -> authz.authorizePath(AuthScope(listOf("/ws"), emptyList()), path) }
        val client = connectAuthenticated()
        val path = "/etc/elsewhere.erd.json"
        val params = """{"path":"$path","create":true,"initialValue":"{}","actions":[]}"""

        val methods = listOf("openDocument", "join", "applyActions", "leave", "save")
        methods.forEachIndexed { index, method -> client.send(request(index + 2, method, params)) }
        val answers = client.next(methods.size)

        val refusal = """{"code":"outsideWorkspace","message":"$path is neither inside a workspace folder nor an open document"}"""
        assertEquals(methods.map { refusal }, answers.map { HubJson.stringify(it.get("error")) })
        assertEquals(methods, answers.map { it.get("method").textValue() })
        assertEquals(emptyList<RecordingHandler.Call>(), handler.calls)
        val touched = env.fs.calls.map { it.op }.toSet()
        assertEquals(setOf(FakeOp.REAL_PATH, FakeOp.LSTAT), touched)
    }

    @Test
    fun `logs the first write that fails once, then counts every later frame written unwritten, and keeps serving`() {
        val client = connectAuthenticated()
        val failure = IOException("EPIPE")
        client.channel.failNextWrite(failure)

        client.send(request(2, "rejoin"), request(3, "listDocuments"), request(4, "listDocuments"), request(5, "listDocuments"))
        client.settle()
        val peer = handler.calls.last().connection
        peer.notify(HubNotification.DocumentClosed("/a"))
        peer.drain().get(5, TimeUnit.SECONDS)

        assertEquals(listOf("answered rejoin with badRequest", "could not write to a peer"), log.texts)
        assertSame(failure, log.lines[1].second)
        assertEquals(3, handler.calls.size)
        assertEquals(emptyList<JsonNode>(), client.fresh())
        assertEquals(emptyList<HubConnection>(), handler.disconnects)
    }

    @Test
    fun `frames a notification to the peer, and drops it once the peer is gone`() {
        val client = connectAuthenticated()
        val peer = peerOf(client)

        peer.notify(HubNotification.DocumentClosed("/a"))
        assertEquals("""{"method":"documentClosed","params":{"path":"/a"}}""", HubJson.stringify(client.next(1).single()))
        client.channel.closeFromPeer()
        awaitUntil(message = "the hub read the EOF") { client.channel.isReadEnded }
        client.connection.finished.get(5, TimeUnit.SECONDS)
        peer.notify(HubNotification.DocumentClosed("/b"))

        // The disconnect is posted to the registry thread, so it can land after finished.
        awaitUntil(message = "disconnect") { handler.disconnects.isNotEmpty() }
        assertEquals(emptyList<JsonNode>(), client.fresh())
        assertEquals(listOf(peer), handler.disconnects)
    }

    @Test
    fun `logs and drops a notification that cannot be framed, and still sends the next`() {
        val client = connectAuthenticated()
        val peer = peerOf(client)
        var nested: JsonNode = HubJson.nodes.arrayNode()
        repeat(200_000) { nested = HubJson.nodes.arrayNode().add(nested) }

        peer.notify(HubNotification.Actions("/a", HubJson.nodes.arrayNode().add(HubJson.nodes.pojoNode(Any()))))
        peer.notify(HubNotification.Actions("/a", nested as ArrayNode))
        peer.notify(HubNotification.DocumentClosed("/a"))

        assertEquals("documentClosed", client.next(1).single().get("method").textValue())
        assertEquals(listOf("request failed", "request failed"), log.texts)
        assertTrue(log.lines[0].second is IllegalArgumentException)
        assertTrue(log.lines[1].second is StackOverflowError)
    }

    @Test
    fun `relays a batch of a 21 million character string from one peer to another`() {
        val receiver = connectAuthenticated()
        val other = peerOf(receiver)
        handler.answer(HubMethod.APPLY_ACTIONS) { params, _ ->
            val batch = params as ApplyParams
            other.notify(HubNotification.Actions(batch.path, batch.actions))
            HandlerResult(HubResults.applyActions(1))
        }
        val sender = connectAuthenticated()
        val text = "a".repeat(21_000_000)

        sender.send(request(2, "applyActions", """{"path":"/a","actions":[{"type":"memo.add","payload":{"value":"$text"}}]}"""))

        assertEquals(1, sender.next(1).single().get("result").get("webviews").intValue())
        val relayed = receiver.next(1).single()
        assertEquals("/real/a", relayed.get("params").get("path").textValue())
        assertEquals(text.length, relayed.get("params").get("actions").get(0).get("payload").get("value").textValue().length)
    }

    @Test
    fun `resolves a drain once the frames queued before it are written, not before`() {
        val client = connectAuthenticated()
        val peer = peerOf(client)
        val release = client.channel.hold()

        peer.notify(HubNotification.DocumentClosed("/a"))
        peer.notify(HubNotification.DocumentClosed("/b"))
        val draining = peer.drain()
        awaitUntil(message = "the writer blocked") { client.channel.isWriteBlocked }
        assertFalse(draining.isDone)
        assertEquals(emptyList<JsonNode>(), client.fresh())

        release()
        draining.get(5, TimeUnit.SECONDS)
        assertEquals(listOf("/a", "/b"), client.fresh().map { it.get("params").get("path").textValue() })
        assertTrue(peer.drain().isDone)
    }

    @Test
    fun `counts a frame the channel refused as written, logging it`() {
        val client = connectAuthenticated()
        val peer = peerOf(client)
        client.channel.failNextWrite(IOException("EPIPE"))

        peer.notify(HubNotification.DocumentClosed("/a"))
        peer.drain().get(5, TimeUnit.SECONDS)

        assertEquals(listOf("could not write to a peer"), log.texts)
    }

    @Test
    fun `resolves a drain for a connection that stopped writing, whatever it still held`() {
        val client = connectAuthenticated()
        val peer = peerOf(client)
        val release = client.channel.hold()
        peer.notify(HubNotification.DocumentClosed("/a"))
        val draining = peer.drain()

        client.channel.closeFromPeer()
        awaitUntil(message = "the hub read the EOF") { client.channel.isReadEnded }
        release()
        draining.get(5, TimeUnit.SECONDS)

        peer.notify(HubNotification.DocumentClosed("/b"))
        peer.drain().get(5, TimeUnit.SECONDS)
        client.connection.finished.get(5, TimeUnit.SECONDS)
    }

    @Test
    fun `keeps every drain and every frame in order when many threads notify while one ends it`() {
        val client = connectAuthenticated()
        val peer = peerOf(client)
        val perThread = 3_334
        val notified = AtomicInteger()
        val start = CyclicBarrier(4)
        val drains = CopyOnWriteArrayList<CompletableFuture<Unit>>()
        val writers = (0 until 3).map { writer ->
            thread(name = "erd-test-notify-$writer") {
                start.await()
                repeat(perThread) {
                    peer.notify(HubNotification.DocumentClosed("/$writer/$it"))
                    notified.incrementAndGet()
                }
            }
        }
        val ender = thread(name = "erd-test-end") {
            start.await()
            // Drains race the writers throughout; the end lands with about half of them notified.
            while (notified.get() < perThread * 3 / 2) drains += peer.drain()
            peer.end()
            repeat(1_000) { drains += peer.drain() }
        }
        (writers + ender).forEach { it.join(20_000) }

        drains.forEach { it.get(5, TimeUnit.SECONDS) }
        awaitUntil(message = "the output ended") { client.channel.isOutputShutdown }
        assertEquals("no write after the end", 0, client.channel.lateWrites)
        val paths = client.fresh().map { it.get("params").get("path").textValue() }
        assertTrue("frames went out before the end", paths.size >= perThread * 3 / 2)
        val byWriter = paths.groupBy({ it.split('/')[1].toInt() }, { it.split('/')[2].toInt() })
        for ((writer, sent) in byWriter) {
            assertEquals("writer $writer's frames arrive as a prefix, in order", sent.indices.toList(), sent)
        }
        peer.notify(HubNotification.DocumentClosed("/late"))
        assertTrue(peer.drain().isDone)
    }

    @Test
    fun `ends gracefully once its queued frames are out, skips what the peer sends after, and disconnects at its EOF`() {
        val client = connectAuthenticated()
        val peer = peerOf(client)

        peer.notify(HubNotification.DocumentClosed("/a"))
        peer.end()
        peer.end()
        peer.notify(HubNotification.DocumentClosed("/b"))
        client.send(request(2, "listDocuments"))
        client.settle()

        assertEquals(listOf("/a"), client.fresh().map { it.get("params").get("path").textValue() })
        assertTrue(client.channel.isOutputShutdown)
        assertFalse(client.channel.isDestroyed)
        assertEquals("only the listDocuments that found the peer", 1, handler.calls.size)
        assertEquals(emptyList<HubConnection>(), handler.disconnects)

        client.channel.closeFromPeer()
        client.connection.finished.get(5, TimeUnit.SECONDS)
        awaitUntil(message = "disconnect") { handler.disconnects == listOf(peer) }
        assertEquals(1, client.channel.closeCount)
    }

    @Test
    fun `reads to the end after a refused hello, then releases the channel without a disconnect`() {
        val client = connect()

        client.send(hello(token = "wrong"))
        client.settle()
        client.send(hello(), request(2, "listDocuments"))
        client.send("""{"pad":"${"x".repeat(200_000)}"}""")
        client.settle()

        assertEquals(1, client.fresh().size)
        assertTrue(client.channel.isOutputShutdown)
        client.channel.closeFromPeer()
        client.connection.finished.get(5, TimeUnit.SECONDS)
        assertEquals(1, client.channel.closeCount)
        assertEquals(emptyList<RecordingHandler.Call>(), handler.calls)
        assertEquals(listOf("refused a hello with a token that is not in the lock file"), log.texts)
    }

    @Test
    fun `tells the handler once when an authenticated peer hangs up, and never about one that did not say hello`() {
        val authenticated = connectAuthenticated()
        val peer = peerOf(authenticated)
        val anonymous = connect()

        authenticated.channel.closeFromPeer()
        anonymous.channel.closeFromPeer()
        authenticated.connection.finished.get(5, TimeUnit.SECONDS)
        anonymous.connection.finished.get(5, TimeUnit.SECONDS)

        awaitUntil(message = "disconnect") { handler.disconnects.isNotEmpty() }
        assertEquals(listOf(peer), handler.disconnects)
    }

    @Test
    fun `never calls the handler for a request whose peer left during authorization`() {
        val resolve = CountDownLatch(1)
        authorize = { path ->
            resolve.await(5, TimeUnit.SECONDS)
            "/real$path"
        }
        val client = connectAuthenticated()

        client.send(request(2, "join", """{"path":"/a"}"""), request(3, "applyActions", """{"path":"/a","actions":[]}"""))
        awaitUntil(message = "authorization entered") { authorized.size == 1 }
        client.channel.closeFromPeer()
        awaitUntil(message = "the hub read the EOF") { client.channel.isReadEnded }
        resolve.countDown()
        client.connection.finished.get(5, TimeUnit.SECONDS)

        assertEquals(emptyList<RecordingHandler.Call>(), handler.calls)
        assertEquals(listOf("/a"), authorized)
    }

    @Test
    fun `lets a request finish after its peer left, and writes no answer for it`() {
        val release = CompletableDeferred<Unit>()
        val saved = CompletableFuture<Unit>()
        handler.answerOnce(HubMethod.SAVE) { _, _ ->
            release.await()
            saved.complete(Unit)
            HandlerResult(HubResults.save(true))
        }
        val client = connectAuthenticated()

        client.send(request(2, "save", """{"path":"/a"}"""))
        awaitUntil(message = "save called") { handler.calls.isNotEmpty() }
        client.channel.closeFromPeer()
        awaitUntil(message = "the hub read the EOF") { client.channel.isReadEnded }
        client.connection.finished.get(5, TimeUnit.SECONDS)
        release.complete(Unit)
        saved.get(5, TimeUnit.SECONDS)
        awaitUntil(message = "the save answered") { client.connection.isQuiet() }

        assertEquals(emptyList<JsonNode>(), client.fresh())
        assertEquals(0, client.channel.lateWrites)
        assertEquals(1, handler.calls.size)
    }

    @Test
    fun `hangs up every connection when the hub stops, even one held in a batch, and serves nothing after`() {
        handler.answerOnce(HubMethod.APPLY_ACTIONS) { _, _ ->
            CompletableDeferred<Unit>().await()
            HandlerResult(HubResults.applyActions(1))
        }
        val authenticated = connectAuthenticated()
        val peer = peerOf(authenticated)
        val anonymous = connect()
        authenticated.send(request(2, "applyActions", """{"path":"/a","actions":[]}"""))
        awaitUntil(message = "the batch called") { handler.calls.size == 2 }

        authenticated.connection.destroyNow()
        anonymous.connection.destroyNow()
        authenticated.connection.finished.get(5, TimeUnit.SECONDS)
        anonymous.connection.finished.get(5, TimeUnit.SECONDS)
        authenticated.send(request(3, "listDocuments"))

        assertTrue(authenticated.channel.isDestroyed && anonymous.channel.isDestroyed)
        awaitUntil(message = "disconnect") { handler.disconnects.isNotEmpty() }
        assertEquals(listOf(peer), handler.disconnects)
        assertEquals(2, handler.calls.size)
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `hangs up after the frames already queued when asked to`() {
        val client = connectAuthenticated()
        val peer = peerOf(client)
        val release = client.channel.hold()

        peer.notify(HubNotification.DocumentClosed("/a"))
        client.connection.hangUp()
        peer.notify(HubNotification.DocumentClosed("/b"))
        release()
        client.connection.finished.get(5, TimeUnit.SECONDS)

        assertEquals(listOf("/a"), client.fresh().map { it.get("params").get("path").textValue() })
        assertTrue(client.channel.isDestroyed)
        assertFalse(client.channel.isOutputShutdown)
    }

    @Test
    fun `serves nobody once its threads stopped`() {
        val stopped = testThreads.create(log).apply { shutdown(2_000) }
        val channel = MemoryChannel()
        val options = ServeOptions(TOKEN, "vscode", "2.9.0", handler, { it }, ids::incrementAndGet, stopped, log)

        val connection = serveConnection(channel, options)
        connection.start()

        connection.finished.get(5, TimeUnit.SECONDS)
        assertTrue(channel.isDestroyed)
        assertEquals(1, channel.closeCount)
    }

    @Test
    fun `lets go of a live connection when its threads stop under it`() {
        val threads = testThreads.create(log)
        val channel = MemoryChannel()
        val options = ServeOptions(TOKEN, "vscode", "2.9.0", handler, { it }, ids::incrementAndGet, threads, log)
        val connection = serveConnection(channel, options).apply { start() }
        channel.send(hello())
        awaitUntil(message = "the hello answered") { channel.received.size == 1 }

        threads.shutdown(2_000)

        // Destroyed by the interrupted writer, or ended by the serving loop's finish if that came first.
        connection.finished.get(5, TimeUnit.SECONDS)
        assertTrue(channel.isDestroyed || channel.isOutputShutdown)
        assertEquals(1, channel.closeCount)
    }

    private companion object {
        const val TOKEN = "6f1c2e0a-8f7e-4d4c-9a51-3a8e2b1d0c9f"

        fun hello(token: String = TOKEN) =
            """{"id":1,"method":"hello","params":{"token":"$token","protocolVersion":1,"client":"spec"}}"""
    }
}
