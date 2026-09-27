package com.github.dineug.erdeditorintellijplugin.hub.document

import com.github.dineug.erdeditorintellijplugin.hub.AuthScope
import com.github.dineug.erdeditorintellijplugin.hub.HubErrorCode
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.server.ApplyParams
import com.github.dineug.erdeditorintellijplugin.hub.server.OpenParams
import com.github.dineug.erdeditorintellijplugin.hub.server.PathParams
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeDocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeIdeFacade.OpenBehaviour
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeOp
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeView
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingConnection
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.io.IOException
import java.util.concurrent.CancellationException

/**
 * The six handlers of Obsidian's handlers.test.ts and join.test.ts and VS Code's autoOpen, leave and
 * save suites, over the registry with fake editors and a fake IDE, plus the IDE's own rules: trust
 * read per request, an open that answers within its cap whatever the EDT does, a bounded save.
 */
class HubRequestHandlerTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    @get:Rule
    val testThreads = TestThreads()

    private val log = RecordingLog()

    private fun harness(timings: HubTimings = DOCUMENT_TIMINGS) = DocumentHarness(testThreads.create(log), log, timings)

    /** The IDE's open makes a ready editor of the file, as a new tab's page would ask for its value. */
    private fun DocumentHarness.opensReady(writable: Boolean = true) {
        ide.openBehaviour = OpenBehaviour.Run { path, known ->
            val file = known as? FakeDocumentFile ?: FakeDocumentFile(path, isWritable = writable)
            val view = FakeView("opened").attach(registry, file, threads)
            registry.addView(file, view)
            registry.onViewReady(file, view, fs.textOf(path) ?: "")
        }
    }

    private fun DocumentHarness.openDoc(path: String, create: Boolean = false, initialValue: String? = null) =
        call { openDocument(OpenParams(path, create, initialValue), RecordingConnection()) }.result.json()

    private fun DocumentHarness.apply(path: String, actions: String, peer: RecordingConnection) =
        call { applyActions(ApplyParams(path, batch(actions)), peer) }.result.json()

    private fun DocumentHarness.saveDocument(path: String) =
        call { save(PathParams(path), RecordingConnection()) }.result.json()

    private fun DocumentHarness.isJoined(path: String, peer: RecordingConnection) =
        onRegistry { find(path)?.let { isJoined(it, peer) } == true }

    private fun opened(path: String, opened: Boolean, webviews: Int) =
        "{\"path\":\"$path\",\"opened\":$opened,\"webviews\":$webviews}"

    private fun joined(text: String, version: Int, readonly: Boolean = false) =
        "{\"initialValue\":${HubJson.quote(text)},\"snapshotVersion\":$version,\"readonly\":$readonly}"

    private fun elapsedSince(started: Long) = (System.nanoTime() - started) / 1_000_000

    /** No ready wait an open made is left behind, nor the timer that goes with it. */
    private fun DocumentHarness.assertNoReadyWait() = assertEquals(0, onRegistry { pendingReadyWaits })

    // listDocuments

    @Test
    fun `lists the open documents first, then every ERD file of the projects, each once by its real path`() {
        val h = harness()
        h.addFile("$WS/z.erd")
        h.addFile("$WS/b.erd.json")
        h.env.links["$WS/link.vuerd"] = "$WS/b.erd.json"
        h.openReady("$WS/c.erd")
        val open = h.openReady(A, "{}")
        h.onRegistry { setActive(open.file) }
        h.relay(open, add(1))
        h.ide.erdFiles = listOf("$WS/z.erd", "$WS/link.vuerd", "$WS/b.erd.json", A)

        val result = h.call { listDocuments(HubJson.nodes.objectNode(), RecordingConnection()) }

        fun closed(path: String) =
            "{\"path\":\"$path\",\"open\":false,\"active\":false,\"dirty\":false,\"readonly\":false}"
        assertEquals(
            "{\"documents\":[" +
                "{\"path\":\"$WS/c.erd\",\"open\":true,\"active\":false,\"dirty\":false,\"readonly\":false}," +
                "{\"path\":\"$A\",\"open\":true,\"active\":true,\"dirty\":true,\"readonly\":false}," +
                closed("$WS/z.erd") + "," + closed("$WS/b.erd.json") + "]}",
            result.result.json(),
        )
        assertTrue(h.ide.openCalls.isEmpty())
    }

    @Test
    fun `lists a read-only document after the writable ones, and marks what only untrusted projects hold`() {
        val h = harness()
        h.scope = AuthScope(listOf(WS, UNTRUSTED), emptyList())
        h.ide.projects = listOf(ProjectTrust(listOf(WS), true), ProjectTrust(listOf(UNTRUSTED), false))
        val broken = h.openReady("$WS/broken.erd")
        broken.file.isWritable = false
        h.openReady("$UNTRUSTED/a.erd")
        h.openReady(A)
        h.addFile("$UNTRUSTED/b.erd")
        h.ide.erdFiles = listOf("$UNTRUSTED/b.erd")

        val documents = h.call { listDocuments(HubJson.nodes.objectNode(), RecordingConnection()) }
            .result.get("documents").map { it.get("path").textValue() to it.get("readonly").booleanValue() }

        assertEquals(
            listOf(
                "$UNTRUSTED/a.erd" to true, A to false, "$WS/broken.erd" to true, "$UNTRUSTED/b.erd" to true,
            ),
            documents,
        )
        assertEquals(1, h.ide.trustReads.get())
    }

    // openDocument

    @Test
    fun `opens a closed file in the background and answers once its editor is ready`() {
        val h = harness()
        h.addFile(A, EMPTY)
        h.opensReady()

        assertEquals(opened(A, true, 1), h.openDoc(A))
        assertEquals(listOf(A to null), h.ide.openCalls)
    }

    @Test
    fun `answers at once, opening and writing nothing, when a ready editor already shows the file`() {
        val h = harness()
        h.openReady(A)

        assertEquals(opened(A, false, 1), h.openDoc(A, create = true, initialValue = EMPTY))
        assertTrue(h.ide.openCalls.isEmpty())
        assertTrue(h.fs.callsOf(FakeOp.CREATE_EXCLUSIVE).isEmpty())
    }

    @Test
    fun `waits for an editor still loading, handing the IDE the file it registered`() {
        val h = harness()
        val loading = h.open(A, "{}")
        awaitUntil { h.onRegistry { find(A)?.resolved == true } }
        h.ide.openBehaviour = OpenBehaviour.Run { _, _ -> h.registry.onViewReady(loading.file, loading.view, "{}") }

        assertEquals(opened(A, true, 1), h.openDoc(A))
        assertSame(loading.file, h.ide.openCalls.single().second)
    }

    @Test
    fun `gives up after its cap when no editor reports ready, even with the open still running`() {
        val h = harness()
        h.addFile(A)
        val text = "No ERD editor on $A reported ready within 5000 ms"

        var started = System.nanoTime()
        assertRefusal(HubErrorCode.NOT_OPEN, text) { h.openDoc(A) }
        assertTrue(elapsedSince(started) >= DOCUMENT_TIMINGS.openReadyTimeoutMs)

        val stuck = OpenBehaviour.Hang()
        h.ide.openBehaviour = stuck
        started = System.nanoTime()
        assertRefusal(HubErrorCode.NOT_OPEN, text) { h.openDoc(A) }
        assertTrue(elapsedSince(started) >= DOCUMENT_TIMINGS.openReadyTimeoutMs)
        h.assertNoReadyWait()
        stuck.gate.complete(Unit)

        h.openReady(A)
        assertEquals(2, h.ide.openCalls.size)
    }

    @Test
    fun `refuses a read-only file at once, and one that opens read-only once it has`() {
        val h = harness()
        val readonly = h.openReady(A)
        readonly.file.isWritable = false
        h.addFile(B)
        h.opensReady(writable = false)
        val refusal = "$A is open only as a read-only file, since the IDE cannot write it; " +
            "make it writable, then call again"

        assertRefusal(HubErrorCode.READONLY, refusal) { h.openDoc(A) }
        assertTrue(h.ide.openCalls.isEmpty())
        assertRefusal(HubErrorCode.READONLY) { h.openDoc(B) }
        assertEquals(listOf(B to null), h.ide.openCalls)
    }

    @Test
    fun `creates a missing file from initialValue, then opens it, and leaves an existing one untouched`() {
        val h = harness()
        h.opensReady()

        assertEquals(opened(A, true, 1), h.openDoc(A, create = true, initialValue = EMPTY))
        assertEquals(listOf(listOf(A, EMPTY)), h.fs.callsOf(FakeOp.CREATE_EXCLUSIVE))
        assertEquals(EMPTY, h.fs.textOf(A))

        h.addFile(B, "{\"kept\":true}")
        assertEquals(opened(B, true, 1), h.openDoc(B, create = true, initialValue = EMPTY))
        assertEquals("{\"kept\":true}", h.fs.textOf(B))
    }

    @Test
    fun `refuses create without initialValue, a missing file and a missing folder, opening nothing`() {
        val h = harness()
        h.opensReady()

        assertRefusal(
            HubErrorCode.BAD_REQUEST,
            "openDocument with create needs a string initialValue, the bytes of an empty document",
        ) { h.openDoc(A, create = true) }
        assertRefusal(HubErrorCode.NOT_FOUND, "$A does not exist") { h.openDoc(A) }
        assertRefusal(HubErrorCode.NOT_FOUND, "The folder of $WS/gone/a.erd does not exist") {
            h.openDoc("$WS/gone/a.erd", create = true, initialValue = EMPTY)
        }

        assertTrue(h.fs.callsOf(FakeOp.CREATE_EXCLUSIVE).size == 1)
        assertTrue(h.ide.openCalls.isEmpty())
        h.assertNoReadyWait()
    }

    @Test
    fun `passes on a file system failure it has no code for, opening nothing`() {
        val h = harness()
        h.addFile(A)
        h.opensReady()

        h.fs.failNext(FakeOp.STAT_EXISTING, IOException("busy"))
        assertThrows(IOException::class.java) { h.openDoc(A) }
        h.assertNoReadyWait()
        h.fs.failNext(FakeOp.CREATE_EXCLUSIVE, IOException("EIO"))
        assertThrows(IOException::class.java) { h.openDoc(A, create = true, initialValue = EMPTY) }

        assertTrue(h.ide.openCalls.isEmpty())
        h.assertNoReadyWait()
    }

    @Test
    fun `answers notOpen with the reason at once when the IDE cannot open the file`() {
        val h = harness()
        h.addFile(A)
        h.ide.openBehaviour = OpenBehaviour.Throw(OpenRefused(DocumentRules.REASON_NO_VIRTUAL_FILE))

        val started = System.nanoTime()
        assertRefusal(
            HubErrorCode.NOT_OPEN,
            "IntelliJ IDEA could not open $A in the ERD editor: the IDE cannot find the file",
        ) { h.openDoc(A) }
        assertTrue(elapsedSince(started) < DOCUMENT_TIMINGS.openReadyTimeoutMs)

        h.ide.openBehaviour = OpenBehaviour.Throw(IllegalStateException("boom"))
        assertRefusal(
            HubErrorCode.NOT_OPEN,
            "IntelliJ IDEA could not open $A in the ERD editor: IllegalStateException: boom",
        ) { h.openDoc(A) }
    }

    @Test
    fun `refuses a path that is no ERD file before it looks at the disk`() {
        val h = harness()

        assertRefusal(HubErrorCode.BAD_REQUEST) { h.openDoc("$WS/MODEL.VUERD.JSON.bak") }
        assertRefusal(HubErrorCode.NOT_FOUND) { h.openDoc("$WS/MODEL.VUERD.JSON") }

        assertEquals(1, h.fs.callsOf(FakeOp.STAT_EXISTING).size)
    }

    @Test
    fun `refuses an open after shutdown, on a file an editor shows ready as on any other`() {
        val h = harness()
        h.openReady(A)
        h.onRegistry { shutdown() }

        for (path in listOf(A, B)) {
            assertRefusal(
                HubErrorCode.NOT_OPEN,
                "IntelliJ IDEA could not open $path in the ERD editor: the ERD Editor plugin is turning off",
            ) { h.openDoc(path) }
        }
        assertTrue(h.ide.openCalls.isEmpty())
    }

    @Test
    fun `answers an open still waiting when the plugin turns off, and opens nothing after it`() {
        val h = harness()
        h.addFile(A)
        h.addFile(B)
        val opening = h.start { openDocument(OpenParams(A, false, null), RecordingConnection()) }
        awaitUntil { h.ide.openCalls.isNotEmpty() }
        val stat = h.fs.hold(FakeOp.STAT_EXISTING)
        val checking = h.start { openDocument(OpenParams(B, false, null), RecordingConnection()) }
        stat.awaitEntered()

        h.onRegistry { shutdown() }
        stat.release()

        for ((path, open) in listOf(A to opening, B to checking)) {
            assertRefusal(
                HubErrorCode.NOT_OPEN,
                "IntelliJ IDEA could not open $path in the ERD editor: ${DocumentRules.REASON_TURNING_OFF}",
            ) { open.get() }
        }
        h.onRegistry {}
        assertEquals(listOf(A to null), h.ide.openCalls)
        h.assertNoReadyWait()
    }

    @Test
    fun `refuses an open when the plugin turns off while it reads the projects' trust`() {
        val h = harness()
        h.openReady(A)
        val gate = CompletableDeferred<Unit>()
        h.ide.trustGate = gate
        val opening = h.start { openDocument(OpenParams(A, false, null), RecordingConnection()) }
        awaitUntil { h.ide.trustReads.get() == 1 }

        h.onRegistry { shutdown() }
        gate.complete(Unit)

        assertRefusal(HubErrorCode.NOT_OPEN) { opening.get() }
        assertTrue(h.ide.openCalls.isEmpty())
    }

    // join

    @Test
    fun `joins at once with the content, observed version and readonly when nothing changed`() {
        val h = harness()
        val editor = h.openReady(A, EMPTY)
        h.relay(editor, "{\"type\":\"editor.getLWW\",\"version\":2}")

        assertEquals(joined(EMPTY, 2), h.join(A, RecordingConnection()).json())
    }

    @Test
    fun `waits after a change for the replica save and captures what it saved`() {
        val h = harness(PATIENT_TIMINGS)
        val editor = h.openReady(A, "{}")
        h.relay(editor, add(4))

        val joining = h.startJoin(A, RecordingConnection())
        Thread.sleep(50)
        assertFalse(joining.isCompleted)
        h.save(editor, "{\"tables\":1}")

        assertEquals(joined("{\"tables\":1}", 4), joining.get().json())
    }

    @Test
    fun `wakes on the last save of the editors a change reached, not on one readied after it`() {
        val h = harness()
        val first = h.openReady(A, "{}")
        val second = h.ready(h.add(first.file))
        h.relay(first, add(4))
        val late = h.add(first.file)
        h.onRegistry { onViewReady(first.file, late.view, "{}") }

        val joining = h.startJoin(A, RecordingConnection())
        h.save(first, "{\"from\":\"first\"}")
        h.onRegistry {}
        assertFalse(joining.isCompleted)
        h.save(second, "{\"from\":\"second\"}")

        assertEquals(joined("{\"from\":\"second\"}", 4), joining.get().json())
        h.awaitReady(late)
        assertEquals(listOf("{\"from\":\"second\"}"), late.view.initialValues)
    }

    @Test
    fun `gives up waiting at the cap and captures what the document holds`() {
        val h = harness()
        val editor = h.openReady(A, "{\"old\":true}")
        h.relay(editor, add(4))

        val started = System.nanoTime()
        assertEquals(joined("{\"old\":true}", 4), h.join(A, RecordingConnection()).json())
        assertTrue(elapsedSince(started) >= DOCUMENT_TIMINGS.joinQuietCapMs)
    }

    @Test
    fun `counts a peer batch as a change, so the next join waits for a save that can hold it`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        val writer = RecordingConnection(1)
        h.join(A, writer)
        h.apply(A, add(8), writer)

        val joining = h.startJoin(A, RecordingConnection(2))
        h.clock.advance(199.0)
        h.save(editor, "{\"before\":8}")
        h.onRegistry {}
        assertFalse(joining.isCompleted)
        h.clock.advance(1.0)
        h.save(editor, "{\"peer\":8}")

        assertEquals(joined("{\"peer\":8}", 8), joining.get().json())
    }

    @Test
    fun `queues deliveries during the window and empties them through both filters`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        h.relay(editor, add(3))
        val joining = RecordingConnection(2)

        val result = h.startJoin(A, joining)
        awaitUntil { h.isJoined(A, joining) }
        h.relay(editor, batchOf(add(5), add(null, "table.move")))
        h.save(editor, "{\"saved\":5}")
        assertEquals(5, result.get().get("snapshotVersion").intValue())
        h.relay(editor, add(6, "memo.add"))

        assertEquals(listOf(batchOf(add(6, "memo.add"))), joining.actionsText())
        assertEquals(
            listOf(
                "dropped 2 queued actions joining $A: versioned at most 5, or unversioned" to
                    mapOf("webview" to mapOf("table.add" to 1, "table.move" to 1)),
            ),
            log.lines,
        )
    }

    @Test
    fun `queues a batch another peer applies during the window and filters it the same way`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        val writer = RecordingConnection(1)
        h.join(A, writer)
        h.relay(editor, add(2))
        val joining = RecordingConnection(2)

        val result = h.startJoin(A, joining)
        awaitUntil { h.isJoined(A, joining) }
        h.relay(editor, add(3))
        h.apply(A, batchOf(add(2, "memo.add"), add(null, "memo.move")), writer)
        h.apply(A, add(7, "memo.add"), writer)
        h.clock.advance(200.0)
        h.save(editor, "{}")

        assertEquals(7, result.get().get("snapshotVersion").intValue())
        assertTrue(joining.actionsText().isEmpty())
        assertEquals(
            listOf(
                "dropped 4 queued actions joining $A: versioned at most 7, or unversioned" to
                    mapOf("webview" to mapOf("table.add" to 1), "peer" to mapOf("memo.add" to 2, "memo.move" to 1)),
            ),
            log.lines,
        )
    }

    @Test
    fun `delivers whole and in order what arrives between the snapshot and the answer`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        h.relay(editor, add(4))
        val peer = RecordingConnection()

        val joining = h.start { join(PathParams(A), peer) }
        awaitUntil { h.isJoined(A, peer) }
        h.relay(editor, add(3, "memo.add"))
        h.save(editor, "{\"saved\":4}")
        val result = joining.get()
        h.relay(editor, batchOf(add(null, "table.move"), add(2, "memo.add")))
        h.relay(editor, add(9))
        assertTrue(peer.notifications.isEmpty())

        h.onRegistry { result.afterResponse!!.invoke() }

        assertEquals(4, result.result.get("snapshotVersion").intValue())
        assertEquals(listOf(batchOf(add(null, "table.move"), add(2, "memo.add")), batchOf(add(9))), peer.actionsText())
        assertEquals(
            listOf(
                "dropped 1 queued actions joining $A: versioned at most 4, or unversioned" to
                    mapOf("webview" to mapOf("memo.add" to 1)),
            ),
            log.lines,
        )
    }

    @Test
    fun `refuses a join whose document closes, or whose peer hangs up, during the wait`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        h.relay(editor, add(1))
        val joining = h.startJoin(A, RecordingConnection())
        awaitUntil { h.onRegistry { find(A)!!.peers.isNotEmpty() } }
        h.onRegistry { removeView(editor.file, editor.view) }
        assertRefusal(HubErrorCode.NOT_OPEN, "$A closed, or the peer left it, before the join finished") {
            joining.get()
        }

        val again = h.openReady(A, "{}")
        h.relay(again, add(1))
        val peer = RecordingConnection()
        val hungUp = h.startJoin(A, peer)
        awaitUntil { h.isJoined(A, peer) }
        h.call { disconnect(peer) }
        h.save(again, "{}")
        assertRefusal(HubErrorCode.NOT_OPEN) { hungUp.get() }
        h.relay(again, add(2))
        assertTrue(peer.notifications.isEmpty())
    }

    @Test
    fun `restarts the window for a peer that joins again, dropping the first queue`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        val peer = RecordingConnection()

        val first = h.call { join(PathParams(A), peer) }
        h.relay(editor, add(3))
        val again = h.startJoin(A, peer)
        h.save(editor, "{}")
        again.get()
        h.onRegistry { first.afterResponse!!.invoke() }

        assertTrue(peer.actionsText().isEmpty())
        h.relay(editor, add(4))
        assertEquals(listOf(batchOf(add(4))), peer.actionsText())
    }

    @Test
    fun `reads a document no editor shows from disk, without byte order marks and without joining`() {
        val h = harness()
        h.addFile(A, "\uFEFF{\"version\":\"3.0.0\"}")
        h.addFile(B, "\uFEFF\uFEFF{}")
        val peer = RecordingConnection()

        assertEquals(joined("{\"version\":\"3.0.0\"}", 0), h.join(A, peer).json())
        assertEquals(joined("{}", 0), h.join(B, peer).json())

        assertTrue(h.ide.openCalls.isEmpty())
        val editor = h.openReady(A)
        h.relay(editor, add(1))
        assertTrue(peer.notifications.isEmpty())
    }

    @Test
    fun `answers a missing file with notFound, and another read failure with itself`() {
        val h = harness()
        assertRefusal(HubErrorCode.NOT_FOUND, "$A does not exist") { h.join(A, RecordingConnection()) }

        h.addFile(A)
        h.fs.failNext(FakeOp.READ_TEXT, IOException("busy"))
        assertThrows(IOException::class.java) { h.join(A, RecordingConnection()) }
    }

    @Test
    fun `answers a read-only file with its text and readonly, and tells the peer when it closes`() {
        val h = harness()
        val editor = h.openReady(A, "{\"doc\": <<<<<<< HEAD")
        editor.file.isWritable = false
        val peer = RecordingConnection()

        assertEquals(joined("{\"doc\": <<<<<<< HEAD", 0, readonly = true), h.join(A, peer).json())
        h.onRegistry { removeView(editor.file, editor.view) }

        assertEquals(listOf(A), peer.closedSent())
    }

    @Test
    fun `refuses a join of a path that is no ERD file, reading nothing`() {
        val h = harness()

        assertRefusal(
            HubErrorCode.BAD_REQUEST,
            "$WS/note.md is not an ERD file; the hub serves .erd, .vuerd, .erd.json, .vuerd.json only",
        ) { h.join("$WS/note.md", RecordingConnection()) }
        assertTrue(h.fs.callsOf(FakeOp.READ_TEXT).isEmpty())
    }

    @Test
    fun `answers a join after shutdown from disk, and only then tells the peer documentClosed`() {
        val h = harness()
        val editor = h.openReady(A, "{\"on\":\"disk\"}")
        h.onRegistry { shutdown() }
        val peer = RecordingConnection()

        val result = h.call { join(PathParams(A), peer) }
        assertTrue(peer.notifications.isEmpty())
        h.onRegistry { result.afterResponse!!.invoke() }
        h.relay(editor, add(1))

        assertEquals(joined("{\"on\":\"disk\"}", 0), result.result.json())
        assertEquals(listOf(A), peer.closedSent())
        assertTrue(peer.actionsText().isEmpty())
    }

    @Test
    fun `answers a disk join whose path the last revoke dropped, then closes it and ends the peer`() {
        val h = harness()
        h.addFile(A)
        h.onRegistry { revoke(AuthScope(listOf("/other"), emptyList())) }
        val peer = RecordingConnection()

        val result = h.call { join(PathParams(A), peer) }
        assertTrue(peer.notifications.isEmpty())
        h.onRegistry { result.afterResponse!!.invoke() }

        assertEquals(joined("{}", 0), result.result.json())
        assertEquals(listOf(A), peer.closedSent())
        assertTrue(peer.ended)
    }

    @Test
    fun `answers a join of an open document the last revoke dropped from disk, then closes it and ends the peer`() {
        val h = harness()
        val editor = h.openReady(A, "{\"on\":\"disk\"}")
        h.save(editor, "{\"mirror\":1}")
        h.onRegistry { revoke(AuthScope(listOf("/other"), emptyList())) }
        val peer = RecordingConnection()

        val result = h.call { join(PathParams(A), peer) }
        assertTrue(peer.notifications.isEmpty())
        assertFalse(peer.ended)
        h.onRegistry { result.afterResponse!!.invoke() }

        assertEquals(joined("{\"on\":\"disk\"}", 0), result.result.json())
        assertEquals(listOf(A), peer.closedSent())
        assertTrue(peer.ended)
        assertFalse(h.isJoined(A, peer))
    }

    @Test
    fun `answers a join of a file only untrusted projects hold from disk, even while an editor shows it`() {
        val h = harness()
        h.scope = AuthScope(listOf(WS, UNTRUSTED), emptyList())
        h.ide.projects = listOf(ProjectTrust(listOf(WS), true), ProjectTrust(listOf(UNTRUSTED), false))
        val editor = h.openReady("$UNTRUSTED/a.erd", "{\"disk\":0}")
        h.save(editor, "{\"mirror\":1}")
        val peer = RecordingConnection()

        assertEquals(joined("{\"disk\":0}", 0), h.join("$UNTRUSTED/a.erd", peer).json())

        assertFalse(h.isJoined("$UNTRUSTED/a.erd", peer))
        assertEquals(listOf(peer), h.onRegistry { shutdown() })
    }

    // applyActions

    @Test
    fun `injects a peer batch into every ready editor and every other peer, never back to the sender`() {
        val h = harness()
        val first = h.openReady(A)
        val second = h.ready(h.add(first.file))
        val a = RecordingConnection(1)
        val b = RecordingConnection(2)
        h.join(A, a)
        h.join(A, b)

        assertEquals("{\"webviews\":2}", h.apply(A, add(3), a))

        assertEquals(listOf(batchOf(add(3))), first.view.injected)
        assertEquals(listOf(batchOf(add(3))), second.view.injected)
        assertEquals(listOf(batchOf(add(3))), b.actionsText())
        assertTrue(a.actionsText().isEmpty())
    }

    @Test
    fun `refuses a batch for a document no ready editor shows, opening nothing`() {
        val h = harness()
        h.addFile(A)
        val notReady = "$A is not open in an ERD editor that is ready; open it with openDocument, then join"
        assertRefusal(HubErrorCode.NOT_OPEN, notReady) { h.apply(A, "[]", RecordingConnection()) }

        val loading = h.open(A)
        val peer = RecordingConnection()
        h.join(A, peer)
        assertRefusal(HubErrorCode.NOT_OPEN, notReady) { h.apply(A, "[]", peer) }
        assertTrue(loading.view.events.isEmpty())

        val hold = h.env.hold(FakeOp.REAL_PATH)
        val unresolved = h.open(B)
        hold.awaitEntered()
        h.onRegistry { onViewReady(unresolved.file, unresolved.view, "{}") }
        assertRefusal(HubErrorCode.NOT_OPEN) { h.apply(B, "[]", peer) }
        hold.release()
        assertTrue(h.ide.openCalls.isEmpty())
    }

    @Test
    fun `refuses a peer that has not joined, a read-only file ahead of the ready check, and no ERD file`() {
        val h = harness()
        h.openReady(A)
        assertRefusal(HubErrorCode.NOT_OPEN, "Join $A before applying actions to it") {
            h.apply(A, "[]", RecordingConnection())
        }

        val readonly = h.open(B)
        readonly.file.isWritable = false
        assertRefusal(
            HubErrorCode.READONLY,
            "$B is open only as a read-only file, since the IDE cannot write it; make it writable, then call again",
        ) { h.apply(B, "[]", RecordingConnection()) }

        assertRefusal(HubErrorCode.BAD_REQUEST) { h.apply("$WS/a.json", "[]", RecordingConnection()) }
    }

    // leave, documentClosed, disconnect

    @Test
    fun `stops every delivery to the peer that left, and only to it`() {
        val h = harness()
        val editor = h.openReady(A)
        val leaving = RecordingConnection(1)
        val staying = RecordingConnection(2)
        h.join(A, leaving)
        h.join(A, staying)

        assertEquals("{}", h.call { leave(PathParams(A), leaving) }.result.json())
        h.relay(editor, add(1))

        assertTrue(leaving.actionsText().isEmpty())
        assertEquals(listOf(batchOf(add(1))), staying.actionsText())
        assertRefusal(HubErrorCode.NOT_OPEN, "Join $A before applying actions to it") { h.apply(A, "[]", leaving) }
    }

    @Test
    fun `drops the queue of a peer that leaves inside its join window, and its join fails`() {
        val h = harness()
        val editor = h.openReady(A)
        h.relay(editor, add(1))
        val peer = RecordingConnection()

        val joining = h.startJoin(A, peer)
        awaitUntil { h.isJoined(A, peer) }
        h.relay(editor, add(2))
        h.call { leave(PathParams(A), peer) }
        h.save(editor, "{}")

        assertRefusal(HubErrorCode.NOT_OPEN) { joining.get() }
        assertTrue(peer.notifications.isEmpty())
    }

    @Test
    fun `answers a leave by a peer that never joined, or of a path no editor shows, all the same`() {
        val h = harness()
        h.openReady(A)

        assertEquals("{}", h.call { leave(PathParams(A), RecordingConnection()) }.result.json())
        assertEquals("{}", h.call { leave(PathParams(B), RecordingConnection()) }.result.json())
    }

    @Test
    fun `tells the peers of a document when its last editor closes, by its real path, and no one else`() {
        val h = harness()
        h.addFile("/real/a.erd")
        h.env.links[A] = "/real/a.erd"
        val first = h.ready(h.open(A), disk = "{}")
        val second = h.ready(h.add(first.file))
        h.openReady(B)
        val peer = RecordingConnection(1)
        val other = RecordingConnection(2)
        h.join("/real/a.erd", peer)
        h.join(B, other)

        h.onRegistry { removeView(first.file, first.view) }
        assertTrue(peer.closedSent().isEmpty())
        h.onRegistry { removeView(first.file, second.view) }

        assertEquals(listOf("/real/a.erd"), peer.closedSent())
        assertTrue(other.closedSent().isEmpty())
    }

    @Test
    fun `makes a reopened document take a fresh join before any batch`() {
        val h = harness()
        val editor = h.openReady(A)
        val peer = RecordingConnection()
        h.join(A, peer)
        h.onRegistry { removeView(editor.file, editor.view) }

        h.openReady(A)

        assertRefusal(HubErrorCode.NOT_OPEN, "Join $A before applying actions to it") { h.apply(A, "[]", peer) }
    }

    @Test
    fun `tells the peers of a rename by the old path and serves the new one`() {
        val h = harness()
        val editor = h.openReady(A)
        val peer = RecordingConnection()
        h.join(A, peer)
        val moved = "$WS/moved/a.erd"
        h.addFile(moved)

        editor.file.localPath = moved
        h.onRegistry { pathsMayHaveChanged() }
        awaitUntil { h.onRegistry { find(moved)?.resolved == true } }

        assertEquals(listOf(A), peer.closedSent())
        assertEquals(opened(moved, false, 1), h.openDoc(moved))
    }

    @Test
    fun `removes a peer whose connection closed from every document`() {
        val h = harness()
        val a = h.openReady(A)
        val b = h.openReady(B)
        val peer = RecordingConnection()
        h.join(A, peer)
        h.join(B, peer)

        h.call { disconnect(peer) }
        h.relay(a, add(1))
        h.relay(b, add(1))
        h.onRegistry { removeView(a.file, a.view) }

        assertTrue(peer.notifications.isEmpty())
    }

    // save

    @Test
    fun `writes the mirror through the editor that opened first and answers what it reports`() {
        val h = harness()
        val writer = h.openReady(A, "{}")
        val other = h.ready(h.add(writer.file))
        h.save(other, "{\"saved\":1}")

        assertEquals("{\"saved\":true}", h.saveDocument(A))

        assertEquals(listOf("{\"saved\":1}"), writer.view.writeCalls)
        assertTrue(other.view.writeCalls.isEmpty())
    }

    @Test
    fun `answers saved false, logging it, when the write leaves the file unsaved or throws`() {
        val h = harness()
        val writer = h.openReady(A, "{}")
        val failure = IOException("EACCES")

        writer.view.writeResult = false
        assertEquals("{\"saved\":false}", h.saveDocument(A))
        writer.view.writeResult = failure
        assertEquals("{\"saved\":false}", h.saveDocument(A))
        writer.view.writeResult = CancellationException("the page closed")
        assertEquals("{\"saved\":false}", h.saveDocument(A))

        assertEquals("$A is still unsaved after its editor saved it" to null, log.lines[0])
        // Under the coroutines debug agent await() rethrows a copy of the failure, with its message.
        assertEquals("saving $A failed", log.lines[1].first)
        assertEquals(failure.message, (log.lines[1].second as IOException).message)
        assertEquals("saving $A failed" to null, log.lines[2])
        assertTrue(log.lines.none { it.second is CancellationException })
    }

    @Test
    fun `waits for the replica to save a fresh edit before it writes`() {
        val h = harness(PATIENT_TIMINGS)
        val editor = h.openReady(A, "{}")
        h.relay(editor, add(1))

        val saving = h.start { save(PathParams(A), RecordingConnection()) }
        Thread.sleep(50)
        assertTrue(editor.view.writeCalls.isEmpty())
        h.save(editor, "{\"saved\":1}")

        assertEquals("{\"saved\":true}", saving.get().result.json())
        assertEquals(listOf("{\"saved\":1}"), editor.view.writeCalls)
    }

    @Test
    fun `answers saved false and writes nothing when no replica saves the edit within its cap`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        h.relay(editor, add(1))

        val started = System.nanoTime()
        assertEquals("{\"saved\":false}", h.saveDocument(A))

        assertTrue(elapsedSince(started) >= DOCUMENT_TIMINGS.saveQuietCapMs)
        assertTrue(editor.view.writeCalls.isEmpty())
        assertEquals(
            listOf(
                "$A has an edit no replica saved within 2000 ms; its bytes may lack it, so nothing was saved" to null,
            ),
            log.lines,
        )
    }

    @Test
    fun `never takes a save sent before the replica held the batch for the one that holds it`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        val peer = RecordingConnection()
        h.join(A, peer)
        h.apply(A, add(2), peer)

        val saving = h.start { save(PathParams(A), peer) }
        h.save(editor, "{\"before\":2}")
        h.onRegistry {}
        assertFalse(saving.isCompleted)
        h.clock.advance(200.0)
        h.save(editor, "{\"peer\":2}")

        assertEquals("{\"saved\":true}", saving.get().result.json())
        assertEquals(listOf("{\"peer\":2}"), editor.view.writeCalls)
    }

    @Test
    fun `waits only for the editors a change reached, not one that asked for its value after it`() {
        val h = harness()
        val first = h.openReady(A, "{}")
        h.relay(first, add(1))
        val late = h.add(first.file)
        h.onRegistry { onViewReady(first.file, late.view, "{}") }

        val saving = h.start { save(PathParams(A), RecordingConnection()) }
        h.save(first, "{\"saved\":1}")

        assertEquals("{\"saved\":true}", saving.get().result.json())
    }

    @Test
    fun `refuses with notOpen when the document closes while save waits for its replica`() {
        val h = harness()
        // Outside every folder of the lock, save reads no trust, so its first registry step is its quiet wait.
        val editor = h.openReady(DOC, "{}")
        h.relay(editor, add(1))

        val saving = h.start { save(PathParams(DOC), RecordingConnection()) }
        h.onRegistry {}
        h.onRegistry { removeView(editor.file, editor.view) }

        assertRefusal(HubErrorCode.NOT_OPEN, "$DOC closed before it could be saved") { saving.get() }
        assertTrue(editor.view.writeCalls.isEmpty())
    }

    @Test
    fun `refuses a save of a document no editor shows, a read-only file and no ERD file`() {
        val h = harness()
        assertRefusal(HubErrorCode.NOT_OPEN, "$A is not open in an ERD editor") { h.saveDocument(A) }

        val readonly = h.openReady(A)
        readonly.file.isWritable = false
        assertRefusal(
            HubErrorCode.READONLY,
            "$A is open only as a read-only file, since the IDE cannot write it, and cannot be saved",
        ) { h.saveDocument(A) }

        assertRefusal(HubErrorCode.BAD_REQUEST) { h.saveDocument("$WS/a.md") }
    }

    @Test
    fun `saves nothing of a document no editor loaded yet, and nothing to a file gone or locked meanwhile`() {
        val h = harness()
        val loading = h.open(A)
        awaitUntil { h.onRegistry { find(A)?.resolved == true } }
        assertEquals("{\"saved\":true}", h.saveDocument(A))
        assertTrue(loading.view.writeCalls.isEmpty())

        // Outside every folder of the lock, save reads no trust, so its first registry step is its quiet wait.
        val editor = h.openReady(DOC, "{}")
        h.relay(editor, add(1))
        var saving = h.start { save(PathParams(DOC), RecordingConnection()) }
        h.onRegistry {}
        editor.file.isValid = false
        h.save(editor, "{\"saved\":1}")
        assertEquals("{\"saved\":false}", saving.get().result.json())

        editor.file.isValid = true
        h.relay(editor, add(2))
        saving = h.start { save(PathParams(DOC), RecordingConnection()) }
        h.onRegistry {}
        editor.file.isWritable = false
        h.save(editor, "{\"saved\":2}")
        assertRefusal(HubErrorCode.NOT_OPEN, "$DOC closed before it could be saved") { saving.get() }
        assertTrue(editor.view.writeCalls.isEmpty())
    }

    @Test
    fun `writes the mirror as it stands when the write runs, not when save began`() {
        val h = harness()
        // Outside every folder of the lock, save reads no trust, so one registry step starts its write.
        val editor = h.openReady(DOC, "{}")
        h.save(editor, "{\"older\":1}")
        val gate = CompletableDeferred<Unit>()
        editor.view.writeGate = gate

        val saving = h.start { save(PathParams(DOC), RecordingConnection()) }
        h.onRegistry {}
        h.save(editor, "{\"newer\":1}")
        gate.complete(Unit)

        assertEquals("{\"saved\":true}", saving.get().result.json())
        assertEquals(listOf("{\"newer\":1}"), editor.view.writeCalls)
    }

    @Test
    fun `answers saved false at its bound when the write never finishes`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        editor.view.writeGate = CompletableDeferred()

        val started = System.nanoTime()
        assertEquals("{\"saved\":false}", h.saveDocument(A))

        assertTrue(elapsedSince(started) >= DOCUMENT_TIMINGS.saveWriteBoundMs)
        assertEquals(listOf("could not write $A within 10000 ms" to null), log.lines)
        assertTrue(editor.view.writeCalls.isEmpty())
    }

    // trust

    @Test
    fun `refuses every change to a file only untrusted projects hold, reading trust once per request`() {
        val h = harness()
        h.scope = AuthScope(listOf(WS, UNTRUSTED), emptyList())
        h.ide.projects = listOf(ProjectTrust(listOf(WS), true), ProjectTrust(listOf(UNTRUSTED), false))
        val path = "$UNTRUSTED/a.erd"
        h.openReady(path)
        val peer = RecordingConnection()
        val refusal = "$path is in a project this IDE does not trust, so the ERD Editor hub will not change it; " +
            "trust the project in the IDE, then call again"

        assertRefusal(HubErrorCode.HUB_DISABLED, refusal) { h.openDoc(path) }
        assertRefusal(HubErrorCode.HUB_DISABLED, refusal) { h.apply(path, "[]", peer) }
        assertRefusal(HubErrorCode.HUB_DISABLED, refusal) { h.saveDocument(path) }

        assertEquals(3, h.ide.trustReads.get())
        assertTrue(h.ide.openCalls.isEmpty())
    }

    @Test
    fun `fails closed on a folder of the lock no open project covers`() {
        val h = harness()
        h.scope = AuthScope(listOf(WS, "/closing"), emptyList())
        h.addFile("/closing/a.erd")

        assertRefusal(HubErrorCode.HUB_DISABLED) { h.openDoc("/closing/a.erd") }
    }

    @Test
    fun `reads no project for a file outside every folder of the lock`() {
        val h = harness()
        h.openReady(DOC)
        val peer = RecordingConnection()

        h.join(DOC, peer)
        h.apply(DOC, "[]", peer)
        assertEquals(opened(DOC, false, 1), h.openDoc(DOC))

        assertEquals(0, h.ide.trustReads.get())
    }

    @Test
    fun `passes on a failure to read the projects' trust`() {
        val h = harness()
        h.ide.trustError = IllegalStateException("the project closed")

        assertThrows(IllegalStateException::class.java) { h.openDoc(A) }
    }

    private companion object {
        const val A = "$WS/a.erd"
        const val B = "$WS/b.erd"
        const val DOC = "/docs/a.erd"
        const val UNTRUSTED = "/untrusted"
        const val EMPTY = "{\"version\":\"3.0.0\"}"
    }
}
