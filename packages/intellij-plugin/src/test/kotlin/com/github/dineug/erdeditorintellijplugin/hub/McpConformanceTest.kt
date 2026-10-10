package com.github.dineug.erdeditorintellijplugin.hub

import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentRules
import com.github.dineug.erdeditorintellijplugin.hub.document.HubView
import com.github.dineug.erdeditorintellijplugin.hub.document.JoinWindow
import com.github.dineug.erdeditorintellijplugin.hub.document.ProjectTrust
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeDocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeIdeFacade
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeView
import com.github.dineug.erdeditorintellijplugin.hub.testing.McpClient
import com.github.dineug.erdeditorintellijplugin.hub.testing.MemoryHost
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingHooks
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestPeer
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Assume
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.rules.Timeout
import org.junit.runner.Description
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

/**
 * The built MCP server of packages/mcp-server against the Kotlin hub run as the plugin runs it, on a
 * temp home both sides are given, with editors made of FakeViews, from the lock to the plugin going
 * away. Without node or the build it skips, unless ERD_MCP_CONFORMANCE=required makes that a failure.
 */
class McpConformanceTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(180)

    @get:Rule
    val testThreads = TestThreads()

    @get:Rule
    val serverOutput = object : TestWatcher() {
        override fun failed(e: Throwable, description: Description) {
            client?.let { System.err.println("MCP server stderr:\n${it.stderr}") }
            System.err.println("hub log: ${log.lines}")
        }
    }

    private val log = RecordingLog()
    private val hooks = RecordingHooks()
    private val peers = CopyOnWriteArrayList<TestPeer>()
    private var client: McpClient? = null
    private var runtime: HubRuntime? = null
    private var home: Path? = null

    @After
    fun tearDown() {
        client?.close()
        peers.forEach(TestPeer::close)
        runtime?.dispose()
        home?.toFile()?.deleteRecursively()
    }

    @Test
    fun `serves the built MCP server as a JetBrains IDE does`() {
        val (node, bin) = requireMcpServer()
        val platform = HubPlatform.current()
        val home = tempHome().also { this.home = it }
        val tmp = Files.createDirectory(home.resolve("t"))
        val pid = ProcessHandle.current().pid()
        val env = MachineEnvironment(home.toString(), tmp.toString(), platform, pid, "0.0.0-conformance")
        val project = realDirectory(env, home.resolve("p"))
        // A second root: a folder inside a trusted project is never untrusted-only.
        val untrusted = realDirectory(env, home.resolve("u"))
        val c = fixture(project, "c.erd.json")
        val d = fixture(project, "d.erd.json")
        val probed = fixture(project, "p.erd.json")
        val b = fixture(untrusted, "b.erd.json")
        val a = project.resolve("a.erd.json").toString()
        val host = MemoryHost(ide = "intellij", roots = listOf(project.toString(), untrusted.toString()))
        val ide = FakeIdeFacade().apply {
            projects = listOf(ProjectTrust(listOf(project.toString()), true), ProjectTrust(listOf(untrusted.toString()), false))
            erdFiles = listOf(c, d, probed, b)
        }
        val runtime = HubRuntime(
            env, host, ide, hooks = hooks, log = log, platform = platform, threads = testThreads.create(log),
        ).also { this.runtime = it }
        val editors = Editors(runtime)
        ide.openBehaviour = FakeIdeFacade.OpenBehaviour.Run(editors::open)
        runtime.start()

        // 1. The lock, and the pipe bound before any agent looks for it.
        awaitUntil(message = "the lock serves") { lock(env)?.hub == true }
        val served = checkNotNull(lock(env))
        assertEquals("intellij", served.ide)
        assertEquals(listOf(project.toString(), untrusted.toString()), served.workspaceFolders)
        assertEquals(HUB_PROTOCOL_VERSION.toLong(), served.protocolVersion)
        assertTrue(served.token, TOKEN.matches(served.token))
        assertEquals(LockPaths.choosePipePath(env.homeDir, env.tmpDir, pid, platform), served.pipe)
        if (!platform.isWindows) assertTrue("the socket is bound", Files.exists(Path.of(served.pipe)))

        val mcp = McpClient.start(node, bin, project, home.toString()).also { client = it }
        mcp.initialize("erd-intellij-conformance")
        assertTrue(mcp.tools().keys.toString(), mcp.tools().keys.containsAll(TOOLS))

        // 2. Live, with the untrusted root's file read-only.
        val listed = mcp.ok("erd_list_documents", emptyMap())
        assertEquals(listed.text, "live", listed.mode)
        assertEquals(listed.text, true, readonlyIn(listed, b))
        assertEquals(listed.text, false, readonlyIn(listed, c))

        // 3. A new document, opened in an editor that is seeded from the file.
        val opened = mcp.ok("erd_open_document", mapOf("path" to "a.erd.json", "create" to true))
        assertEquals(opened.text, "live", opened.mode)
        assertEquals(opened.text, true, opened.json?.path("opened")?.asBoolean())
        assertEquals(listOf<Pair<String, DocumentFile?>>(a to null), ide.openCalls)
        val viewA = editors.view(a)
        val created = Files.readString(Path.of(a))
        assertEquals("3.0.0", HubJson.parse(created).path("version").asText())
        assertEquals(listOf(created), viewA.page.initialValues)

        // 4. An edit reaches the page after its initial value.
        val added = mcp.ok("erd_add_table", mapOf("path" to "a.erd.json"))
        assertEquals(added.text, "live", added.mode)
        val tableId = added.json?.path("createdIds")?.path(0)?.asText().orEmpty()
        val events = viewA.page.events
        assertTrue(events.toString(), events.first() is FakeView.Event.Initial)
        assertTrue(
            events.toString(),
            events.drop(1).filterIsInstance<FakeView.Event.Injected>().any { "\"table.add\"" in it.actions && tableId in it.actions },
        )

        // 5. The page's own edit reaches the agent.
        viewA.relay(tableBatch("t_relay", 90))
        retry("erd_list lists t_relay") { tableIds(mcp.ok("erd_list", mapOf("path" to "a.erd.json"))).containsAll(listOf(tableId, "t_relay")) }

        // 6. A save writes what the replica last saved, once it saved every change.
        val saved = mcp.ok("erd_save", mapOf("path" to "a.erd.json"))
        assertEquals(saved.text, "live", saved.mode)
        assertEquals(saved.text, true, saved.json?.path("saved")?.asBoolean())
        val onDisk = Files.readString(Path.of(a))
        assertEquals(viewA.lastSaved, onDisk)
        assertEquals(listOf(onDisk), viewA.writes)
        assertNotEquals("the file holds the edits", created, onDisk)
        assertFalse(log.texts.toString(), log.texts.any { "no replica saved" in it })

        // 7. A document no editor holds is joined from the file, and tracked.
        val readC = mcp.ok("erd_read", mapOf("path" to "c.erd.json", "format" to "json"))
        assertEquals(readC.text, "3.0.0", readC.json?.path("version")?.asText())
        val watcher = joinedPeer(env, c)

        // 8. The untrusted root: read, never changed.
        val refused = mcp.call("erd_add_table", mapOf("path" to b))
        assertTrue(refused.text, refused.isError)
        assertEquals(refused.text, HubErrorCode.HUB_DISABLED.wire, refused.errorCode)
        assertEquals(DocumentRules.untrustedProject(b).message, refused.errorMessage)
        mcp.ok("erd_read", mapOf("path" to b, "format" to "json"))
        assertProbe(node, home, project, "p.erd.json")
        assertProbe(node, home, untrusted, "b.erd.json", "--expect-untrusted")

        // 9. The editor closes under the agent's edits.
        runtime.registry.post { removeView(viewA.file, viewA) }
        retry("erd_list carries the closed note") { CLOSED_NOTE in mcp.ok("erd_list", mapOf("path" to "a.erd.json")).notes }

        // 10. Coding agents off: a hub false lock, no documentClosed, writes blocked; then on again.
        host.turn(false)
        awaitUntil(message = "the lock turns hub false") { lock(env)?.hub == false }
        // The hub false lock lands before the pipe goes, as DocumentHubTest pins, so the socket is
        // checked once that state change ran to its end, not once the lock reads hub false.
        checkNotNull(runtime.hub).flushed().get(STATE_CHANGE_SECONDS, TimeUnit.SECONDS)
        val off = checkNotNull(lock(env))
        assertEquals("" to "", off.pipe to off.token)
        assertEquals(served.workspaceFolders, off.workspaceFolders)
        if (!platform.isWindows) assertFalse("the socket is gone", Files.exists(Path.of(served.pipe)))
        assertEquals("no documentClosed on the way out", emptyList<String>(), watcher.awaitEof())
        // Closed at EOF, as the MCP server's socket is: a client end left open keeps a Windows pipe
        // name, and the listen below creates that name as its first instance.
        peers.remove(watcher)
        watcher.close()
        val blocked = mcp.call("erd_add_table", mapOf("path" to "d.erd.json"))
        assertTrue(blocked.text, blocked.isError)
        assertEquals(blocked.text, "blocked", blocked.errorCode)
        assertTrue(blocked.text, "a JetBrains IDE (pid $pid) whose ERD Editor hub is turned off or failed to start" in blocked.text)
        assertTrue(blocked.text, ENABLE_HUB in blocked.text)
        assertProbe(node, home, project, "d.erd.json", "--expect-blocked")
        host.turn(true)
        awaitUntil(message = "the lock serves again") { lock(env)?.hub == true }
        val liveD = mcp.ok("erd_add_table", mapOf("path" to "d.erd.json"))
        assertEquals(liveD.text, "live", liveD.mode)

        // 11. A new connection joins c again, and so does a raw peer.
        val againC = mcp.ok("erd_read", mapOf("path" to "c.erd.json", "format" to "json"))
        assertEquals(againC.text, emptyList<String>(), againC.notes)
        val peerC = joinedPeer(env, c)

        // 12. The project closes: its folders leave the lock, and c's peers are told and ended.
        host.roots = emptyList()
        host.fireFoldersChange()
        assertEquals(listOf(closed(c)), peerC.awaitEof())
        awaitUntil(message = "the lock lists no folder") { lock(env)?.workspaceFolders == emptyList<String>() }
        settle()
        val fellC = mcp.ok("erd_add_table", mapOf("path" to "c.erd.json"))
        assertEquals(fellC.text, "headless", fellC.mode)
        assertTrue(fellC.toString(), FELL_BACK in fellC.notes)

        // 13. The plugin goes away within its bounds; the agent falls back to the file.
        val begun = System.nanoTime()
        runtime.dispose()
        val tookMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - begun)
        assertTrue("disposed in $tookMs ms", tookMs < DISPOSE_WITHIN_MS)
        assertNull(lock(env))
        if (!platform.isWindows) assertFalse("the socket is gone", Files.exists(Path.of(served.pipe)))
        assertEquals(emptyList<Thread>(), hooks.active)
        settle()
        val fellD = mcp.ok("erd_add_table", mapOf("path" to "d.erd.json"))
        assertEquals(fellD.text, "headless", fellD.mode)
        assertTrue(fellD.toString(), FELL_BACK in fellD.notes)

        // 14. Nothing failed on the hub's side.
        assertFalse(log.lines.toString(), log.texts.any { it == "request failed" || it == "could not close the document hub" })
    }

    /** The node and the server to run, or a skip, a failure when ERD_MCP_CONFORMANCE=required. */
    private fun requireMcpServer(): Pair<String, Path> {
        val required = (System.getProperty("erd.mcp.conformance")?.takeIf { it.isNotEmpty() } ?: System.getenv("ERD_MCP_CONFORMANCE")) == "required"
        val bin = Path.of(System.getProperty("erd.mcp.bin") ?: "../mcp-server/dist/erd-editor-mcp.js").toAbsolutePath().normalize()
        val node = System.getProperty("erd.mcp.node")?.takeIf { it.isNotBlank() } ?: "node"
        val missing = when {
            !Files.isRegularFile(bin) -> "$bin is missing; build @dineug/erd-editor-mcp first"
            !McpClient.nodeRuns(node) -> "$node --version does not run; put Node 22 on PATH or set ERD_MCP_NODE"
            else -> null
        }
        if (missing != null) {
            if (required) fail(missing)
            Assume.assumeTrue(missing, false)
        }
        return node to bin
    }

    /** Short, as the socket path under it must be: under /tmp on POSIX, the temp directory on Windows. */
    private fun tempHome(): Path =
        if (HubPlatform.current().isWindows) Files.createTempDirectory("erdc") else Files.createTempDirectory(Path.of("/tmp"), "erdc")

    /** A new directory by its real path as the hub spells it, which on Windows is not always the JDK's spelling. */
    private fun realDirectory(env: HubEnvironment, dir: Path): Path =
        Path.of((env.realPath(Files.createDirectory(dir).toString()) as RealPathResult.Ok).path)

    private fun fixture(folder: Path, name: String): String = Files.writeString(folder.resolve(name), EMPTY_DOCUMENT).toString()

    private fun lock(env: HubEnvironment): LockRecord? = try {
        parseLock(Files.readString(Path.of(LockPaths.lockFilePath(env.homeDir, env.pid))))
    } catch (e: IOException) {
        null
    }

    /** A raw peer, as a second agent is one, through the pipe the lock names now and joined to path. */
    private fun joinedPeer(env: HubEnvironment, path: String): TestPeer {
        val lock = checkNotNull(lock(env))
        val peer = TestPeer.connect(lock.pipe).also(peers::add)
        peer.send(
            """{"id":1,"method":"hello","params":{"token":"${lock.token}","protocolVersion":$HUB_PROTOCOL_VERSION,"client":"raw"}}""",
            """{"id":2,"method":"join","params":{"path":${HubJson.quote(path)}}}""",
        )
        val (hello, join) = peer.receiveFrames(2)
        assertTrue(hello, hello.startsWith("""{"id":1,"ok":true"""))
        assertTrue(join, join.startsWith("""{"id":2,"ok":true,"method":"join""""))
        return peer
    }

    /** Runs e2e/mcp-probe.mjs, with the same home, as K8's check and the Windows guide run it; it must exit 0. */
    private fun assertProbe(node: String, home: Path, projectDir: Path, file: String, vararg flags: String) {
        val probe = Path.of(System.getProperty("erd.mcp.probe") ?: "e2e/mcp-probe.mjs").toAbsolutePath()
        val output = Files.createTempFile(home, "probe", ".log")
        val builder = ProcessBuilder(listOf(node, probe.toString(), projectDir.toString(), file) + flags)
            .redirectErrorStream(true)
            .redirectOutput(output.toFile())
        builder.environment()["HOME"] = home.toString()
        builder.environment()["USERPROFILE"] = home.toString()
        val process = builder.start()
        if (!process.waitFor(PROBE_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            process.destroyForcibly()
            fail("the probe of $file ran past $PROBE_TIMEOUT_SECONDS s:\n${Files.readString(output)}")
        }
        assertEquals("the probe of $file ${flags.toList()}:\n${Files.readString(output)}", 0, process.exitValue())
    }

    /** The MCP server reads the frames a peer read just now on a connection of its own. */
    private fun settle() = Thread.sleep(SETTLE_MS)

    private fun McpClient.ok(name: String, arguments: Map<String, Any>): McpClient.ToolResult =
        call(name, arguments).also { assertFalse("$name $arguments: ${it.text}", it.isError) }

    private fun retry(message: String, condition: () -> Boolean) {
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(RETRY_MS)
        while (!condition()) {
            if (System.nanoTime() > deadline) fail("$message did not hold within $RETRY_MS ms")
            Thread.sleep(100)
        }
    }

    private fun readonlyIn(listed: McpClient.ToolResult, path: String): Boolean? =
        listed.json?.path("documents")?.firstOrNull { it.path("path").asText() == path }?.path("readonly")?.asBoolean()

    private fun tableIds(listed: McpClient.ToolResult): List<String> =
        listed.json?.path("tables")?.map { it.path("id").asText() }.orEmpty()

    /**
     * The ERD editors the fake IDE opens, as ErdEditor readies one: register and add the view, then
     * once the page asks, its initial value from the file, after the lock lists it.
     */
    private class Editors(private val runtime: HubRuntime) {
        private val views = ConcurrentHashMap<String, ConformanceView>()

        fun view(path: String): ConformanceView = checkNotNull(views[path]) { "no editor opened $path" }

        suspend fun open(path: String, known: DocumentFile?) {
            val file = known as? FakeDocumentFile ?: FakeDocumentFile(path)
            val view = ConformanceView(runtime, file)
            views[path] = view
            runtime.registry.post {
                register(file)
                addView(file, view)
            }
            delay(PAGE_LOAD_MS)
            val disk = withContext(runtime.threads.io) { NioFileSystem.readText(path) }
            runtime.registry.call {
                awaitListed(file, runtime.timings.initialValueHoldMs)
                onViewReady(file, view, disk)
            }
        }
    }

    /**
     * One editor's page: its FakeView records what reaches it, and like a real replica it saves its
     * text a while after every batch, its own relays included. writeNow writes the file, as ErdEditor does.
     */
    private class ConformanceView(private val runtime: HubRuntime, val file: FakeDocumentFile) : HubView {
        val page = FakeView(file.localPath).apply { applyBatch = ::countChange }
        private val written = CopyOnWriteArrayList<String>()

        /** What the replica last saved, which a save writes. */
        @Volatile
        var lastSaved: String? = null
            private set

        val writes: List<String> get() = written.toList()

        override fun sendInitialValue(value: String) = page.sendInitialValue(value)

        override fun inject(actions: ArrayNode) {
            page.inject(actions)
            saveLater()
        }

        override fun pushReadonly(readonly: Boolean) = page.pushReadonly(readonly)

        override suspend fun writeNow(latest: () -> String): Boolean {
            val value = latest()
            withContext(runtime.threads.io) { Files.writeString(Path.of(file.localPath), value) }
            written += value
            return true
        }

        /** The page's own edit: its text changes, the registry relays it, and the replica saves it. */
        fun relay(actions: ArrayNode) {
            page.text = page.applyBatch(page.text, actions)
            runtime.registry.post { onViewActions(file, this@ConformanceView, actions) }
            saveLater()
        }

        private fun saveLater() {
            runtime.threads.schedule(SAVE_AFTER_MS) {
                val text = page.text
                lastSaved = text
                // A page hands its runtime value with every save; this one holds nothing the file drops.
                runtime.registry.onValueSaved(file, this, text, text)
            }
        }
    }

    private companion object {
        val TOOLS = setOf("erd_list_documents", "erd_open_document", "erd_add_table", "erd_list", "erd_read", "erd_save")
        val TOKEN = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

        /** A valid empty v3 document; the schema's parser fills in the rest, as the editor does. */
        const val EMPTY_DOCUMENT =
            """{"${'$'}schema":"https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json",""" +
                """"version":"3.0.0","settings":{},"doc":{"tableIds":[],"relationshipIds":[],"indexIds":[],"memoIds":[]},""" +
                """"collections":{}}"""

        /** A key the parser drops: the replica's text counts the changes it holds, and stays a document. */
        const val CHANGES = "conformanceChanges"

        const val CLOSED_NOTE =
            "The editor on this document was closed after this agent's last edit, so those edits are in the file " +
                "only if they were saved before it closed; erd_list shows what it holds now."
        const val ENABLE_HUB =
            "Turn on Coding agents under Settings | Tools | ERD Editor in that IDE, or restart that IDE if it is on, then call again."
        const val FELL_BACK =
            "The JetBrains IDE that served this document no longer serves it, so this call edited the file on disk " +
                "instead; edits made through that IDE can no longer be undone."

        const val PAGE_LOAD_MS = 50L
        const val SAVE_AFTER_MS = 250L
        const val SETTLE_MS = 500L
        const val RETRY_MS = 10_000L
        const val STATE_CHANGE_SECONDS = 5L
        const val PROBE_TIMEOUT_SECONDS = 90L

        /** registryCallBoundMs + drainCapMs + closeBoundMs + threadJoinBoundMs is 3 s; the rest is a loaded runner's. */
        const val DISPOSE_WITHIN_MS = 5_000L

        fun countChange(text: String, actions: ArrayNode): String {
            if (!JoinWindow.hasChangeAction(actions)) return text
            val document = HubJson.parse(text) as ObjectNode
            return HubJson.stringify(document.put(CHANGES, document.path(CHANGES).asInt() + 1))
        }

        fun closed(path: String) = """{"method":"documentClosed","params":{"path":${HubJson.quote(path)}}}"""

        /** The VS Code integration test's tableBatch, verbatim: four shared actions a page applies without relaying back. */
        fun tableBatch(tableId: String, version: Int): ArrayNode {
            val meta = """{"editorId":"agent-hub-e2e","nickname":"e2e"}"""
            val column = "${tableId}c"
            fun action(type: String, payload: String) =
                """{"type":"$type","payload":$payload,"version":$version,"tags":1,"meta":$meta}"""
            return HubJson.parse(
                listOf(
                    action("table.add", """{"id":"$tableId","ui":{"x":120,"y":120,"zIndex":2}}"""),
                    action("column.add", """{"id":"$column","tableId":"$tableId"}"""),
                    action("column.changeName", """{"id":"$column","tableId":"$tableId","value":"id"}"""),
                    action("column.changePrimaryKey", """{"id":"$column","tableId":"$tableId","value":true}"""),
                ).joinToString(",", "[", "]"),
            ) as ArrayNode
        }
    }
}
