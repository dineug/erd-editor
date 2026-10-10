package com.github.dineug.erdeditorintellijplugin.hub.document

import com.github.dineug.erdeditorintellijplugin.hub.AuthScope
import com.github.dineug.erdeditorintellijplugin.hub.HubErrorCode
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.server.ApplyParams
import com.github.dineug.erdeditorintellijplugin.hub.server.HubNotification
import com.github.dineug.erdeditorintellijplugin.hub.server.HubPublisher
import com.github.dineug.erdeditorintellijplugin.hub.server.PathParams
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeDocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeOp
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeView
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingConnection
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.io.IOException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArrayList

/**
 * The registry of Obsidian's registry.test.ts and VS Code's documentRegistry.test.ts, with the
 * IntelliJ rules: one step seeds and readies a view, view-to-view relays go through the registry,
 * a join never answers empty, and tracked paths close when the lock's scope stops covering them.
 */
class DocumentRegistryTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    @get:Rule
    val testThreads = TestThreads()

    private val log = RecordingLog()

    private fun harness(
        platform: HubPlatform = HubPlatform.LINUX,
        withHub: Boolean = true,
        timings: HubTimings = DOCUMENT_TIMINGS,
    ) = DocumentHarness(testThreads.create(log), log, timings, platform, withHub)

    /** A publisher that records every list and answers with what the test sets. */
    private class Publisher : HubPublisher {
        val lists = CopyOnWriteArrayList<List<String>>()

        @Volatile
        var answer: () -> CompletableFuture<Unit> = { CompletableFuture.completedFuture(Unit) }

        override fun publish(documents: List<String>): CompletableFuture<Unit> {
            lists += documents
            return answer()
        }
    }

    @Test
    fun `keeps the views of a file in the order they opened, the first writing it`() {
        val h = harness()
        val first = h.openReady(A)
        val second = h.ready(h.add(first.file))
        val entry = h.entry(A)

        assertEquals(listOf(first.view, second.view), h.onRegistry { entry.views.toList() })
        assertSame(first.view, h.onRegistry { writer(entry) })
        h.onRegistry { removeView(first.file, first.view) }
        assertSame(second.view, h.onRegistry { writer(entry) })
        h.onRegistry { removeView(first.file, second.view) }
        assertEquals(emptyList<DocumentEntry>(), h.onRegistry { documents() })
    }

    @Test
    fun `registers a file and a view once, and a file with no view has no writer`() {
        val h = harness()
        h.addFile(A)
        val file = FakeDocumentFile(A)
        val view = FakeView()

        h.onRegistry { register(file) }
        val entry = h.onRegistry { documents().single() }
        assertNull(h.onRegistry { writer(entry) })
        h.onRegistry {
            register(file)
            addView(file, view)
            addView(file, view)
        }
        assertEquals(listOf(view), h.onRegistry { entry.views.toList() })
    }

    @Test
    fun `counts a view ready once however often it says so, and none once every view closed`() {
        val h = harness()
        val first = h.openReady(A)
        val second = h.ready(h.add(first.file))
        val entry = h.entry(A)

        h.ready(first)
        assertEquals(2, h.onRegistry { readyCount(entry) })
        h.onRegistry { removeView(first.file, first.view) }
        assertEquals(1, h.onRegistry { readyCount(entry) })
        h.onRegistry { removeView(first.file, second.view) }
        assertEquals(0, h.onRegistry { readyCount(entry) })
        assertEquals(0, h.onRegistry { applyPeerActions(entry, RecordingConnection(), batch(add(1))) })
    }

    @Test
    fun `counts a seeded view ready only once its path resolved`() {
        val h = harness()
        h.addFile(A)
        val hold = h.env.hold(FakeOp.REAL_PATH)
        val opened = h.open(A)
        hold.awaitEntered()

        h.onRegistry { onViewReady(opened.file, opened.view, "{}") }
        val entry = h.onRegistry { documents().single() }
        assertEquals(listOf("{}"), opened.view.initialValues)
        assertEquals(0, h.onRegistry { readyCount(entry) })

        hold.release()
        h.awaitReady(opened)
        assertEquals(1, h.onRegistry { readyCount(entry) })
    }

    @Test
    fun `wakes an open wait on the real path once a view opened through a link resolves`() {
        val h = harness()
        h.addFile("/real/a.erd")
        h.env.links["$WS/link.erd"] = "/real/a.erd"
        val wait = h.onRegistry { waitForReady("/real/a.erd", 5_000) }

        h.ready(h.open("$WS/link.erd"), disk = "{}")

        val outcome = runBlocking { wait.await() }
        assertEquals("/real/a.erd", (outcome as ReadyOutcome.Ready).entry.path)
    }

    @Test
    fun `ignores what a file or view it does not hold reports`() {
        val h = harness()
        val known = h.openReady(A, "{}")
        val stranger = FakeView("stranger")
        val file = FakeDocumentFile("$WS/nothing.erd")

        h.onRegistry {
            onViewReady(file, stranger, "{}")
            onViewUnready(file, stranger)
            onValueSaved(file, stranger, "x")
            onViewActions(file, stranger, batch(add(1)))
            removeView(file, stranger)
            setActive(file)
            writabilityChanged(file)
            onWritten(file, "x")
            awaitListed(file, 10_000)
            onViewReady(known.file, stranger, "{}")
            onViewUnready(known.file, stranger)
            onValueSaved(known.file, stranger, "x")
            onViewActions(known.file, stranger, batch(add(1)))
            removeView(known.file, stranger)
        }

        val entry = h.entry(A)
        assertEquals(listOf(A), h.onRegistry { documents().map { it.path } })
        assertEquals("{}", entry.content)
        assertEquals(0.0, h.onRegistry { entry.observedVersion }, 0.0)
        assertTrue(stranger.events.isEmpty())
        assertFalse(h.onRegistry { isActive(entry) })
    }

    @Test
    fun `forgets a page that reloads until it asks again, then seeds it from the mirror`() {
        val h = harness()
        val first = h.openReady(A, "{}")
        val second = h.ready(h.add(first.file))
        val entry = h.entry(A)
        val peer = RecordingConnection()
        h.join(A, peer)

        h.onRegistry { onViewUnready(first.file, second.view) }
        assertEquals(1, h.onRegistry { readyCount(entry) })
        h.clock.advance(200.0)
        h.call { applyActions(ApplyParams(A, batch(add(1))), peer) }
        assertEquals(setOf(first.view), h.onRegistry { entry.quiet.awaiting.toSet() })
        h.clock.advance(200.0)
        h.save(first, "{\"saved\":1}")

        h.ready(second, disk = "{\"disk\":1}")
        assertEquals(listOf("{}", "{\"saved\":1}"), second.view.initialValues)
        assertEquals(listOf(batchOf(add(1))), first.view.injected)
        assertTrue(second.view.injected.isEmpty())
    }

    @Test
    fun `seeds the first view from its file and every later one from the mirror while no page hands a runtime value`() {
        val h = harness()
        val first = h.openReady(A, "{\"first\":1}")
        h.save(first, "{\"edited\":1}")

        val second = h.ready(h.add(first.file), disk = "{\"stale\":1}")

        assertEquals(listOf("{\"first\":1}"), first.view.initialValues)
        assertEquals(listOf("{\"edited\":1}"), second.view.initialValues)
        assertEquals("{\"edited\":1}", h.entry(A).content)
    }

    @Test
    fun `seeds a later view and a joining peer from the runtime value a page handed, keeping the mirror`() {
        val h = harness()
        val first = h.openReady(A, "{\"first\":1}")
        h.save(first, "{\"stored\":1}", runtime = "{\"runtime\":1}")

        val second = h.ready(h.add(first.file), disk = "{\"stale\":1}")
        val joined = h.join(A, RecordingConnection())

        assertEquals(listOf("{\"runtime\":1}"), second.view.initialValues)
        assertEquals("{\"runtime\":1}", joined.get("initialValue").textValue())
        assertEquals("{\"stored\":1}", h.entry(A).content)
        assertEquals("{\"first\":1}", h.onRegistry { entryAt(A).lastWritten })
    }

    @Test
    fun `takes the runtime value of a save that changed nothing, leaving the mirror and dirty as they were`() {
        val h = harness()
        val first = h.openReady(A, "{ \"older\": \"bytes\" }")
        h.save(first, null, runtime = "{\"runtime\":2}")

        val reloaded = h.ready(h.add(first.file))

        assertEquals(listOf("{\"runtime\":2}"), reloaded.view.initialValues)
        assertEquals("{ \"older\": \"bytes\" }", h.entry(A).content)
        assertEquals("{ \"older\": \"bytes\" }", h.onRegistry { entryAt(A).lastWritten })
        assertFalse(h.onRegistry { isDirty(entryAt(A)) })
    }

    @Test
    fun `hands a view waiting for its value every batch, inside the value or after it, never before`() {
        val h = harness()
        val first = h.openReady(A, "{}")
        val peer = RecordingConnection()
        h.join(A, peer)
        val second = h.add(first.file)

        h.call { applyActions(ApplyParams(A, batch(add(1))), peer) }
        h.relay(first, add(2))
        h.onRegistry { onViewReady(first.file, second.view, "{\"disk\":0}") }
        assertTrue(second.view.events.isEmpty())
        h.clock.advance(200.0)
        h.save(first, "{\"saved\":2}")
        h.awaitReady(second)
        h.relay(first, add(3))

        assertEquals(
            listOf(FakeView.Event.Initial("{\"saved\":2}"), FakeView.Event.Injected(batchOf(add(3)))),
            second.view.events,
        )
        assertEquals(listOf(batchOf(add(2)), batchOf(add(3))), peer.actionsText())
    }

    @Test
    fun `stops injecting into a page that asks for its value again until it has the new one`() {
        val h = harness()
        val first = h.openReady(A, "{}")
        val second = h.ready(h.add(first.file))
        h.relay(first, add(1))

        h.onRegistry { onViewReady(first.file, second.view, "{}") }
        assertEquals(setOf(first.view), h.onRegistry { entryAt(A).quiet.awaiting.toSet() })
        h.relay(first, add(2))
        h.save(first, "{\"saved\":2}")
        h.awaitReady(second)

        assertEquals(
            listOf(
                FakeView.Event.Initial("{}"),
                FakeView.Event.Injected(batchOf(add(1))),
                FakeView.Event.Initial("{\"saved\":2}"),
            ),
            second.view.events,
        )
    }

    @Test
    fun `seeds a waiting view at the join cap when no replica saves`() {
        val h = harness()
        val first = h.openReady(A, "{\"old\":true}")
        h.relay(first, add(1))
        val second = h.add(first.file)

        val started = System.nanoTime()
        h.onRegistry { onViewReady(first.file, second.view, "{}") }
        h.awaitReady(second)

        assertTrue((System.nanoTime() - started) / 1_000_000 >= DOCUMENT_TIMINGS.joinQuietCapMs)
        assertEquals(listOf("{\"old\":true}"), second.view.initialValues)
    }

    @Test
    fun `never seeds a view that closed or reloaded while it waited`() {
        val h = harness()
        val first = h.openReady(A, "{}")
        h.relay(first, add(1))
        val leaving = h.add(first.file)
        val reloading = h.add(first.file)

        h.onRegistry {
            onViewReady(first.file, leaving.view, "{}")
            onViewReady(first.file, reloading.view, "{}")
        }
        h.onRegistry {
            removeView(first.file, leaving.view)
            onViewUnready(first.file, reloading.view)
        }
        h.save(first, "{\"saved\":1}")
        h.onRegistry {}

        assertTrue(leaving.view.events.isEmpty())
        assertTrue(reloading.view.events.isEmpty())
        assertEquals(1, h.onRegistry { readyCount(entryAt(A)) })
    }

    @Test
    fun `relays a view's batch to the other ready views and every joined peer, in order, by real path`() {
        val h = harness()
        h.addFile("/real/a.erd", "{}")
        h.env.links["$WS/link.erd"] = "/real/a.erd"
        val first = h.ready(h.open("$WS/link.erd"), disk = "{}")
        val second = h.ready(h.add(first.file))
        val peer = RecordingConnection()
        h.join("/real/a.erd", peer)

        h.relay(first, add(1))
        h.relay(second, add(2))
        h.onRegistry { onViewActions(first.file, first.view, HubJson.parse("{\"not\":\"an array\"}")) }

        assertEquals(listOf(batchOf(add(1)), batchOf(add(2))), peer.actionsText())
        assertEquals(setOf("/real/a.erd"), peer.notifications.map { it.path }.toSet())
        assertEquals(listOf(batchOf(add(2))), first.view.injected)
        assertEquals(listOf(batchOf(add(1))), second.view.injected)
        assertEquals(2.0, h.onRegistry { entryAt("/real/a.erd").observedVersion }, 0.0)
    }

    @Test
    fun `relays between views before the path resolves`() {
        val h = harness()
        h.addFile(A, "{}")
        val hold = h.env.hold(FakeOp.REAL_PATH)
        val first = h.open(A)
        val second = h.add(first.file)
        h.onRegistry {
            onViewReady(first.file, first.view, "{}")
            onViewReady(first.file, second.view, "{}")
        }

        h.relay(first, add(1))

        assertEquals(listOf(batchOf(add(1))), second.view.injected)
        hold.release()
    }

    @Test
    fun `injects a peer batch into every ready view and every other peer, one notification for all`() {
        val h = harness()
        val first = h.openReady(A)
        val second = h.ready(h.add(first.file))
        val loading = h.add(first.file)
        val (a, b, c) = listOf(RecordingConnection(1), RecordingConnection(2), RecordingConnection(3))
        for (peer in listOf(a, b, c)) h.join(A, peer)

        val count = h.onRegistry { applyPeerActions(entryAt(A), a, batch(add(3))) }

        assertEquals(2, count)
        assertEquals(listOf(batchOf(add(3))), first.view.injected)
        assertEquals(listOf(batchOf(add(3))), second.view.injected)
        assertTrue(loading.view.events.isEmpty())
        assertEquals(emptyList<String>(), a.actionsText())
        assertSame(b.notifications.single(), c.notifications.single())
        assertEquals(setOf(first.view, second.view), h.onRegistry { entryAt(A).quiet.awaiting.toSet() })

        h.relay(first, add(4))
        assertSame(a.notifications.single(), b.notifications.last())
    }

    @Test
    fun `raises the observed version with numbered actions from views and peers, never lowering it`() {
        val h = harness()
        val editor = h.openReady(A)
        val peer = RecordingConnection()
        h.join(A, peer)

        h.relay(editor, batchOf(add(3), add(null, "table.move")))
        assertEquals(3.0, h.onRegistry { entryAt(A).observedVersion }, 0.0)
        h.onRegistry { applyPeerActions(entryAt(A), peer, batch(batchOf(add(7), add(null, "memo.resize")))) }
        assertEquals(7.0, h.onRegistry { entryAt(A).observedVersion }, 0.0)
        h.relay(editor, add(5))
        assertEquals(7.0, h.onRegistry { entryAt(A).observedVersion }, 0.0)
    }

    @Test
    fun `settles a pending edit when the view still owing a save closes, and keeps waiting with none saved`() {
        val h = harness()
        val first = h.openReady(A)
        val second = h.ready(h.add(first.file))
        h.relay(first, add(1))
        val entry = h.entry(A)

        h.save(second, "{\"saved\":1}")
        assertTrue(h.onRegistry { entry.quiet.pending })
        h.onRegistry { removeView(first.file, first.view) }
        assertTrue(h.onRegistry { whenQuiet(entry, 10_000) })

        h.relay(second, add(2))
        h.onRegistry { removeView(first.file, second.view) }
        val started = System.nanoTime()
        assertFalse(h.onRegistry { whenQuiet(entry, 100) })
        assertTrue((System.nanoTime() - started) / 1_000_000 >= 100)
    }

    @Test
    fun `settles a change on the replica saves of every page it reached`() {
        val h = harness()
        val first = h.openReady(A, "{}")
        val second = h.ready(h.add(first.file))
        first.view.saveAfterRelayMs = 10
        second.view.saveAfterInjectMs = 10

        h.relay(first, add(1))

        assertTrue(h.onRegistry { whenQuiet(entryAt(A), 5_000) })
        assertEquals("{}" + batchOf(add(1)), h.entry(A).content)
    }

    @Test
    fun `reads the file for a join while no view was ever ready, never answering empty`() {
        val h = harness()
        h.addFile(A, "\uFEFF\uFEFF{\"version\":\"3.0.0\"}")
        val opened = h.open(A)
        awaitResolved(h, A)
        val peer = RecordingConnection()

        val outcome = h.onRegistry { join(entryAt(A), peer) }

        assertEquals(
            "{\"initialValue\":\"{\\\"version\\\":\\\"3.0.0\\\"}\",\"snapshotVersion\":0,\"readonly\":false}",
            outcome.result.json(),
        )
        assertTrue(h.onRegistry { isJoined(entryAt(A), peer) })
        assertNull(h.entry(A).content)
        assertTrue(opened.view.events.isEmpty())
    }

    @Test
    fun `answers a join from the mirror when a view turns ready during its disk read`() {
        val h = harness(timings = PATIENT_TIMINGS)
        h.addFile(A, "{\"disk\":1}")
        val opened = h.open(A)
        awaitResolved(h, A)
        val peer = RecordingConnection()
        val hold = h.fs.hold(FakeOp.READ_TEXT)

        val joining = h.threads.scope.async(h.threads.registry) { h.registry.join(h.registry.find(A)!!, peer) }
        hold.awaitEntered()
        h.ready(opened, disk = "{\"mirror\":1}")
        h.relay(opened, add(1))
        hold.release()
        Thread.sleep(50)
        assertFalse(joining.isCompleted)
        h.save(opened, "{\"mirror\":2}")

        assertEquals("{\"mirror\":2}", joining.get().result.get("initialValue").textValue())
    }

    @Test
    fun `takes the mirror at once when a view turns ready during the read after the join cap passed`() {
        val h = harness()
        h.addFile(A, "{\"disk\":1}")
        val opened = h.open(A)
        awaitResolved(h, A)
        val hold = h.fs.hold(FakeOp.READ_TEXT)

        val joining = h.threads.scope.async(h.threads.registry) {
            h.registry.join(h.registry.find(A)!!, RecordingConnection())
        }
        hold.awaitEntered()
        h.ready(opened, disk = "{\"mirror\":1}")
        h.relay(opened, add(1))
        h.clock.advance(DOCUMENT_TIMINGS.joinQuietCapMs + 1.0)
        hold.release()

        assertEquals("{\"mirror\":1}", joining.get().result.get("initialValue").textValue())
    }

    @Test
    fun `leaves no peer and no tracked path behind a join whose disk read failed`() {
        val h = harness()
        h.addFile(A)
        h.open(A)
        h.open(B)
        awaitResolved(h, A)
        awaitResolved(h, B)
        val peer = RecordingConnection()

        h.fs.failNext(FakeOp.READ_TEXT, IOException("EIO"))
        assertThrows(IOException::class.java) { h.onRegistry { join(entryAt(A), peer) } }
        assertRefusal(HubErrorCode.NOT_FOUND, "$B does not exist") { h.onRegistry { join(entryAt(B), peer) } }

        assertFalse(h.onRegistry { isJoined(entryAt(A), peer) })
        assertFalse(h.onRegistry { isJoined(entryAt(B), peer) })
        assertEquals(emptyList<Any>(), h.onRegistry { shutdown() })
    }

    @Test
    fun `refuses a join after shutdown, or on a document that closed`() {
        val h = harness()
        val opened = h.openReady(A)
        val entry = h.entry(A)
        h.onRegistry { removeView(opened.file, opened.view) }
        val closed = "$A closed, or the peer left it, before the join finished"
        assertRefusal(HubErrorCode.NOT_OPEN, closed) { h.onRegistry { join(entry, RecordingConnection()) } }

        h.openReady(A)
        h.onRegistry { shutdown() }
        assertRefusal(HubErrorCode.NOT_OPEN, closed) { h.onRegistry { join(entryAt(A), RecordingConnection()) } }
    }

    @Test
    fun `empties a join window after the answer, through both filters, and not before`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        h.relay(editor, add(3))
        val peer = RecordingConnection()

        val joining = h.threads.scope.async(h.threads.registry) { h.registry.join(h.registry.find(A)!!, peer) }
        awaitUntil { h.onRegistry { isJoined(entryAt(A), peer) } }
        h.relay(editor, batchOf(add(5), add(null, "table.move")))
        h.save(editor, "{\"saved\":5}")
        val outcome = joining.get()
        h.relay(editor, add(6, "memo.add"))
        assertEquals(emptyList<String>(), peer.actionsText())

        h.onRegistry { outcome.afterResponse() }

        assertEquals(5.0, outcome.result.get("snapshotVersion").asDouble(), 0.0)
        assertEquals(listOf(batchOf(add(6, "memo.add"))), peer.actionsText())
        assertEquals(
            listOf(
                "dropped 2 queued actions joining $A: versioned at most 5, or unversioned" to
                    mapOf("webview" to mapOf("table.add" to 1, "table.move" to 1)),
            ),
            log.lines,
        )
    }

    @Test
    fun `ends no window of a peer that left before the answer went out`() {
        val h = harness()
        val editor = h.openReady(A, "{}")
        val peer = RecordingConnection()
        val outcome = h.onRegistry { join(entryAt(A), peer) }
        h.relay(editor, add(9))

        h.onRegistry {
            leave(A, peer)
            outcome.afterResponse()
        }

        assertTrue(peer.notifications.isEmpty())
    }

    @Test
    fun `tells every peer documentClosed at shutdown for every path it joined, left or read`() {
        val h = harness()
        h.openReady(A)
        h.openReady(B)
        h.addFile(C)
        val peer = RecordingConnection(1)
        val reader = RecordingConnection(2)
        val idle = RecordingConnection(3)
        h.join(A, peer)
        h.join(A, peer)
        h.join(B, peer)
        h.call { leave(PathParams(B), peer) }
        h.join(C, reader)
        h.call { listDocuments(HubJson.nodes.objectNode(), idle) }

        val told = h.onRegistry { shutdown() }

        assertEquals(listOf(peer, reader), told)
        assertEquals(listOf(A, B), peer.closedSent())
        assertEquals(listOf(C), reader.closedSent())
        assertTrue(idle.notifications.isEmpty())
        assertTrue(h.registry.isShutDown)
    }

    @Test
    fun `tells a peer inside its join window at shutdown, whose join then fails`() {
        val h = harness()
        val editor = h.openReady(A)
        h.relay(editor, add(1))
        val peer = RecordingConnection()
        val joining = h.startJoin(A, peer)
        awaitUntil { h.onRegistry { isJoined(entryAt(A), peer) } }

        h.onRegistry { shutdown() }
        h.save(editor, "{}")

        assertRefusal(HubErrorCode.NOT_OPEN) { joining.get() }
        assertEquals(listOf(A), peer.closedSent())
    }

    @Test
    fun `does not tell a peer again at shutdown of a document whose close it heard`() {
        val h = harness()
        val editor = h.openReady(A)
        val peer = RecordingConnection()
        h.join(A, peer)
        h.onRegistry { removeView(editor.file, editor.view) }

        assertEquals(emptyList<Any>(), h.onRegistry { shutdown() })
        assertEquals(listOf(A), peer.closedSent())
    }

    @Test
    fun `ends every open wait at shutdown and lists nothing after it`() {
        val h = harness()
        val publisher = Publisher()
        h.registry.setPublisher(publisher)
        h.openReady(A)
        val wait = h.onRegistry { waitForReady(B, 5_000) }
        val listed = publisher.lists.size

        h.onRegistry { shutdown() }
        h.registry.setPublisher(Publisher())
        h.openReady(C)

        assertEquals(ReadyOutcome.Cancelled, runBlocking { wait.await() })
        assertEquals(listed, publisher.lists.size)
        h.onRegistry { awaitListed(entryAt(C).file, 10_000) }
    }

    @Test
    fun `closes a path for its peer once the lock's scope stops covering it, and ends a peer left with none`() {
        val h = harness()
        h.openReady(P1)
        val other = h.openReady(P2)
        val a = RecordingConnection(1)
        val b = RecordingConnection(2)
        h.join(P1, a)
        h.join(P2, b)

        h.onRegistry { revoke(AuthScope(listOf("/p2"), listOf(P2))) }

        assertEquals(listOf(P1), a.closedSent())
        assertTrue(a.ended)
        assertFalse(h.onRegistry { isJoined(entryAt(P1), a) })
        h.relay(other, add(1))
        assertEquals(listOf(batchOf(add(1))), b.actionsText())
        assertFalse(b.ended)
    }

    @Test
    fun `closes a join held in its quiet wait when the scope shrinks, then ends the peer`() {
        val h = harness()
        val editor = h.openReady(P1)
        h.relay(editor, add(1))
        val peer = RecordingConnection()
        val joining = h.startJoin(P1, peer)
        awaitUntil { h.onRegistry { isJoined(entryAt(P1), peer) } }

        h.onRegistry { revoke(AuthScope(listOf("/p2"), emptyList())) }
        h.save(editor, "{}")

        assertRefusal(HubErrorCode.NOT_OPEN) { joining.get() }
        assertEquals(listOf(P1), peer.closedSent())
        assertTrue(peer.ended)
    }

    @Test
    fun `ends a peer whose closed documents the scope no longer covers, and keeps one it still does`() {
        val h = harness()
        val outside = h.openReady(DOC)
        val inside = h.openReady(P1)
        val a = RecordingConnection(1)
        val b = RecordingConnection(2)
        h.join(DOC, a)
        h.join(P1, b)
        h.onRegistry {
            removeView(outside.file, outside.view)
            removeView(inside.file, inside.view)
        }
        assertFalse(a.ended)

        h.onRegistry { revoke(AuthScope(listOf("/p1"), emptyList())) }

        assertTrue(a.ended)
        assertEquals(1, a.endCalls)
        assertFalse(b.ended)
        h.onRegistry { revoke(AuthScope(listOf("/p1"), emptyList())) }
        assertEquals(1, a.endCalls)
    }

    @Test
    fun `refuses to track a path the last revoked scope does not admit, and closes it after the answer`() {
        val h = harness()
        val lone = RecordingConnection(1)
        val busy = RecordingConnection(2)
        val early = RecordingConnection(3)
        h.onRegistry { closeUntracked(early, P2) }
        assertEquals(listOf(P2), early.closedSent())
        assertFalse(early.ended)

        h.onRegistry { revoke(AuthScope(listOf("/p1"), emptyList())) }
        assertFalse(h.onRegistry { track(lone, P2) })
        h.onRegistry { closeUntracked(lone, P2) }
        assertTrue(h.onRegistry { track(busy, P1) })
        h.onRegistry { closeUntracked(busy, P2) }

        assertEquals(listOf(P2), lone.closedSent())
        assertTrue(lone.ended)
        assertEquals(listOf(P2), busy.closedSent())
        assertFalse(busy.ended)
    }

    @Test
    fun `answers a join of a document the last revoked scope no longer admits from its file, then closes it`() {
        val h = harness()
        val editor = h.openReady(P1, "\uFEFF\uFEFF{\"disk\":1}")
        h.save(editor, "{\"mirror\":1}")
        val peer = RecordingConnection()
        h.onRegistry { revoke(AuthScope(listOf("/p2"), emptyList())) }

        val outcome = h.onRegistry { join(entryAt(P1), peer) }
        assertTrue(peer.notifications.isEmpty())
        assertFalse(peer.ended)
        h.onRegistry { outcome.afterResponse() }

        assertEquals(
            "{\"initialValue\":\"{\\\"disk\\\":1}\",\"snapshotVersion\":0,\"readonly\":false}",
            outcome.result.json(),
        )
        assertEquals(listOf(P1), peer.closedSent())
        assertTrue(peer.ended)
        assertFalse(h.onRegistry { isJoined(entryAt(P1), peer) })
    }

    @Test
    fun `keeps what a peer heard closed through a join that failed, so a revoke still ends it`() {
        val h = harness()
        val closing = h.openReady(DOC)
        h.open(P1)
        awaitResolved(h, P1)
        val peer = RecordingConnection()
        h.join(DOC, peer)
        h.onRegistry { removeView(closing.file, closing.view) }

        h.fs.failNext(FakeOp.READ_TEXT, IOException("EIO"))
        assertThrows(IOException::class.java) { h.onRegistry { join(entryAt(P1), peer) } }
        h.onRegistry { revoke(AuthScope(listOf("/p1"), emptyList())) }

        assertEquals(listOf(DOC), peer.closedSent())
        assertTrue(peer.ended)
    }

    @Test
    fun `forgets what a peer heard closed once a join of another document succeeds`() {
        val h = harness()
        val closing = h.openReady(DOC)
        h.openReady(P1)
        val peer = RecordingConnection()
        h.join(DOC, peer)
        h.onRegistry { removeView(closing.file, closing.view) }

        h.join(P1, peer)
        h.onRegistry { revoke(AuthScope(listOf("/docs"), emptyList())) }

        assertEquals(listOf(DOC, P1), peer.closedSent())
        assertTrue(peer.ended)
    }

    @Test
    fun `keeps a path the peer tracked before a join of it that failed`() {
        val h = harness()
        h.addFile(A, "{}")
        h.open(A)
        awaitResolved(h, A)
        val peer = RecordingConnection()
        h.join(A, peer)
        h.call { leave(PathParams(A), peer) }

        h.fs.failNext(FakeOp.READ_TEXT, IOException("EIO"))
        assertThrows(IOException::class.java) { h.onRegistry { join(entryAt(A), peer) } }

        assertFalse(h.onRegistry { isJoined(entryAt(A), peer) })
        assertEquals(listOf(peer), h.onRegistry { shutdown() })
        assertEquals(listOf(A), peer.closedSent())
    }

    @Test
    fun `forgets a connection that closed in every document`() {
        val h = harness()
        val a = h.openReady(A)
        val b = h.openReady(B)
        val peer = RecordingConnection()
        h.join(A, peer)
        h.join(B, peer)

        h.onRegistry { disconnect(peer) }
        h.relay(a, add(1))
        h.relay(b, add(1))
        h.onRegistry { removeView(a.file, a.view) }

        assertTrue(peer.notifications.isEmpty())
        assertEquals(emptyList<Any>(), h.onRegistry { shutdown() })
    }

    @Test
    fun `registers nothing for a connection that hung up while its join or read was in flight`() {
        val h = harness()
        val editor = h.openReady(P1)
        val peer = RecordingConnection()
        h.onRegistry { disconnect(peer) }

        assertRefusal(HubErrorCode.NOT_OPEN) { h.startJoin(P1, peer).get() }
        assertFalse(h.onRegistry { isJoined(entryAt(P1), peer) })
        assertTrue(h.onRegistry { track(peer, P2) })
        h.onRegistry { closeUntracked(peer, P2) }
        h.relay(editor, add(1))
        h.onRegistry { revoke(AuthScope(listOf("/p2"), emptyList())) }

        assertTrue(peer.notifications.isEmpty())
        assertFalse(peer.ended)
        assertEquals(emptyList<Any>(), h.onRegistry { shutdown() })
    }

    @Test
    fun `tells the peers of a renamed file by the old path and lists the new one`() {
        val h = harness()
        val publisher = Publisher()
        h.registry.setPublisher(publisher)
        val editor = h.openReady(A)
        val peer = RecordingConnection()
        h.join(A, peer)
        val moved = "$WS/moved/a.erd"
        h.addFile(moved)

        editor.file.localPath = moved
        h.onRegistry { pathsMayHaveChanged() }
        awaitResolved(h, moved)

        assertEquals(listOf(A), peer.closedSent())
        assertNull(h.onRegistry { find(A) })
        assertEquals(1, h.onRegistry { readyCount(entryAt(moved)) })
        awaitUntil { publisher.lists.last() == listOf(moved) }
    }

    @Test
    fun `moves every file under a renamed folder in one pass`() {
        val h = harness(withHub = false)
        val a = h.openReady("$WS/dir/a.erd")
        val b = h.openReady("$WS/dir/b.erd")
        h.openReady("$WS/kept.erd")
        val peer = RecordingConnection()
        h.join("$WS/dir/a.erd", peer)

        a.file.localPath = "$WS/new/a.erd"
        b.file.localPath = "$WS/new/b.erd"
        h.onRegistry { pathsMayHaveChanged() }

        assertEquals(
            listOf("$WS/new/a.erd", "$WS/new/b.erd", "$WS/kept.erd"),
            h.onRegistry { documents().map { it.path } },
        )
        assertEquals(listOf("$WS/dir/a.erd"), peer.closedSent())
    }

    @Test
    fun `lets go of a file renamed to a name that is no ERD file`() {
        val h = harness()
        val publisher = Publisher()
        h.registry.setPublisher(publisher)
        val editor = h.openReady(A)
        val waiting = h.add(editor.file)
        val peer = RecordingConnection()
        h.join(A, peer)
        h.relay(editor, add(1))
        h.onRegistry { onViewReady(editor.file, waiting.view, "{}") }
        val wait = h.onRegistry { waitForReady(A, 5_000) }
        val entry = h.entry(A)

        editor.file.localPath = "$WS/a.txt"
        h.onRegistry { pathsMayHaveChanged() }
        // The replica's save no longer reaches the let-go entry; settling its wait by hand still seeds
        // nothing, once a few registry steps let the waiting view's resumed step run.
        h.onRegistry { JoinWindow.noteSave(entry.quiet, editor.view, h.clock.nowMs()) }
        repeat(3) { h.onRegistry {} }

        assertEquals(listOf(A), peer.closedSent())
        assertEquals(emptyList<DocumentEntry>(), h.onRegistry { documents() })
        assertTrue(waiting.view.events.isEmpty())
        assertEquals(0, h.onRegistry { readyCount(entry) })
        h.onRegistry { wait.cancel() }
        assertEquals(ReadyOutcome.Cancelled, runBlocking { wait.await() })
        awaitUntil { publisher.lists.last() == emptyList<String>() }
    }

    @Test
    fun `drops a realpath step that lands after its document closed or was renamed`() {
        val h = harness()
        val publisher = Publisher()
        h.registry.setPublisher(publisher)
        h.addFile(A)
        h.addFile(B)
        h.addFile(C)
        val first = h.env.hold(FakeOp.REAL_PATH)
        val closed = h.open(A)
        first.awaitEntered()
        h.onRegistry { removeView(closed.file, closed.view) }
        val second = h.env.hold(FakeOp.REAL_PATH)
        val renamed = h.open(B)
        second.awaitEntered()
        renamed.file.localPath = C
        h.onRegistry { pathsMayHaveChanged() }
        awaitResolved(h, C)

        first.release()
        second.release()
        h.onRegistry {}
        Thread.sleep(50)
        h.onRegistry {}

        assertEquals(listOf(C), publisher.lists.last())
        assertTrue(publisher.lists.none { A in it || B in it })
        assertSame(renamed.file, h.entry(C).file)
    }

    @Test
    fun `pushes a writability change to every page, closes it for peers and wakes an open wait`() {
        val h = harness()
        val first = h.openReady(A)
        val second = h.ready(h.add(first.file))
        val other = h.openReady(B)
        val peer = RecordingConnection()
        h.join(A, peer)
        val wait = h.onRegistry { waitForReady(A, 5_000) }

        first.file.isWritable = false
        h.onRegistry { writabilityChanged(first.file) }

        assertEquals(listOf(true), first.view.readonlyPushes)
        assertEquals(listOf(true), second.view.readonlyPushes)
        assertEquals(listOf(A), peer.closedSent())
        assertSame(h.entry(A), (runBlocking { wait.await() } as ReadyOutcome.Ready).entry)
        assertEquals(listOf(B, A), h.onRegistry { documents().map { it.path } })
        assertNull(h.onRegistry { findWritable(A) })

        first.file.isWritable = true
        h.onRegistry { writabilityChanged(first.file) }
        assertEquals(listOf(true, false), first.view.readonlyPushes)
        assertTrue(other.view.readonlyPushes.isEmpty())
    }

    @Test
    fun `prefers a document an editor can write over a read-only file at the same real path`() {
        val h = harness()
        h.addFile(A)
        h.env.links["$WS/link.erd"] = A
        h.env.links["$WS/other.erd"] = A
        val readonly = h.ready(h.open("$WS/link.erd"), disk = "{}")
        readonly.file.isWritable = false
        val alsoReadonly = h.ready(h.open("$WS/other.erd"), disk = "{}")
        alsoReadonly.file.isWritable = false
        val writable = h.openReady(A)

        assertSame(writable.file, h.onRegistry { find(A)?.file })
        assertSame(writable.file, h.onRegistry { findWritable(A)?.file })
        h.onRegistry { removeView(writable.file, writable.view) }
        assertSame(readonly.file, h.onRegistry { find(A)?.file })
        assertNull(h.onRegistry { findWritable(A) })
    }

    @Test
    fun `publishes the real paths of resolved documents on open and close, each once`() {
        val h = harness()
        h.addFile(A)
        h.env.links["$WS/link.erd"] = A
        val publisher = Publisher()
        h.registry.setPublisher(publisher)
        h.onRegistry {}
        assertEquals(listOf(emptyList<String>()), publisher.lists)

        val a = h.openReady(A)
        val link = h.ready(h.open("$WS/link.erd"), disk = "{}")
        val third = h.ready(h.add(a.file))
        h.onRegistry { removeView(link.file, link.view) }
        h.onRegistry { removeView(a.file, a.view) }
        h.onRegistry { removeView(a.file, third.view) }

        assertEquals(listOf(emptyList(), listOf(A), listOf(A), listOf(A), emptyList()), publisher.lists)
    }

    @Test
    fun `lists a document once resolved, and only then`() {
        val h = harness()
        h.addFile("/real/a.erd")
        h.env.links[A] = "/real/a.erd"
        val publisher = Publisher()
        h.registry.setPublisher(publisher)
        val hold = h.env.hold(FakeOp.REAL_PATH)
        h.open(A)
        hold.awaitEntered()
        h.openReady(B)
        assertEquals(listOf(B), publisher.lists.last())

        hold.release()
        awaitUntil { publisher.lists.last() == listOf("/real/a.erd", B) }
    }

    @Test
    fun `keys a document by the path given when resolving it fails, and still lists it`() {
        val h = harness()
        h.addFile(A)
        h.env.realPathFails += A
        val publisher = Publisher()
        h.registry.setPublisher(publisher)

        h.openReady(A)

        assertEquals(listOf(A), publisher.lists.last())
    }

    @Test
    fun `logs a publisher that fails, and still lets the editor go on`() {
        val h = harness()
        val failure = IOException("disk full")
        val publisher = Publisher().apply { answer = { CompletableFuture.failedFuture(failure) } }
        h.registry.setPublisher(publisher)
        val opened = h.openReady(A)

        h.onRegistry { awaitListed(opened.file, 10_000) }

        assertTrue(("could not list the open documents in the lock" to failure) in log.lines)
    }

    @Test
    fun `holds an editor until the lock lists its file, at most its cap`() {
        val h = harness()
        h.addFile(A)
        h.addFile(B)
        val pending = CompletableFuture<Unit>()
        val publisher = Publisher().apply { answer = { pending } }
        h.registry.setPublisher(publisher)
        val a = h.open(A)
        awaitResolved(h, A)

        val holding = h.threads.scope.async(h.threads.registry) { h.registry.awaitListed(a.file, 10_000) }
        Thread.sleep(30)
        assertFalse(holding.isCompleted)
        pending.complete(Unit)
        holding.get()

        publisher.answer = { CompletableFuture() }
        val b = h.open(B)
        awaitResolved(h, B)
        val started = System.nanoTime()
        h.onRegistry { awaitListed(b.file, 100) }
        assertTrue((System.nanoTime() - started) / 1_000_000 >= 100)
    }

    @Test
    fun `resolves at once without a hub, and lists a file at once without a publisher`() {
        val h = harness(withHub = false)
        val opened = h.open(A, "{}")

        assertTrue(h.onRegistry { entryAt(A).resolved })
        h.onRegistry { awaitListed(opened.file, 10_000) }
        val publisher = Publisher()
        h.registry.setPublisher(publisher)
        h.onRegistry {}
        assertEquals(listOf(listOf(A)), publisher.lists)
    }

    @Test
    fun `matches paths without regard to case on darwin`() {
        val h = harness(platform = HubPlatform.DARWIN)
        h.addFile("/Ws/A.erd")

        val opened = h.ready(h.open("/Ws/A.erd"), disk = "{}")

        assertSame(opened.file, h.onRegistry { find("/ws/a.erd")?.file })
    }

    @Test
    fun `follows the editor that took focus last and forgets a closed document`() {
        val h = harness()
        val a = h.openReady(A)
        val b = h.openReady(B)

        h.onRegistry {
            setActive(a.file)
            setActive(b.file)
        }
        val entryA = h.entry(A)
        val entryB = h.entry(B)
        assertFalse(h.onRegistry { isActive(entryA) })
        assertTrue(h.onRegistry { isActive(entryB) })

        h.onRegistry { removeView(b.file, b.view) }
        assertFalse(h.onRegistry { isActive(entryB) })
        h.onRegistry { setActive(a.file) }
        assertTrue(h.onRegistry { isActive(entryA) })
    }

    @Test
    fun `answers an open wait ready, timed out, cancelled or failed, once`() {
        val h = harness()
        val ready = h.onRegistry { waitForReady(A, 5_000) }
        val other = h.onRegistry { waitForReady(B, 150) }
        val cancelled = h.onRegistry { waitForReady(A, 5_000) }
        val failed = h.onRegistry { waitForReady(A, 5_000) }
        val error = IllegalStateException("boom")

        h.onRegistry {
            cancelled.cancel()
            cancelled.failOpen(error)
            failed.failOpen(error)
            failed.cancel()
        }
        h.openReady(A)

        assertSame(h.entry(A), (runBlocking { ready.await() } as ReadyOutcome.Ready).entry)
        assertEquals(ReadyOutcome.TimedOut, runBlocking { other.await() })
        assertEquals(ReadyOutcome.Cancelled, runBlocking { cancelled.await() })
        assertEquals(ReadyOutcome.OpenFailed(error), runBlocking { failed.await() })
    }

    @Test
    fun `reads dirty off the mirror against what the file last took, or a save still owed`() {
        val h = harness()
        val loading = h.open(B, "{}")
        awaitResolved(h, B)
        assertFalse(h.onRegistry { isDirty(entryAt(B)) })
        h.onRegistry { onWritten(loading.file, "{}") }
        assertFalse(h.onRegistry { isDirty(entryAt(B)) })

        val editor = h.openReady(A, "{}")
        val entry = h.entry(A)
        assertFalse(h.onRegistry { isDirty(entry) })
        h.save(editor, "{\"edited\":1}")
        assertTrue(h.onRegistry { isDirty(entry) })
        h.onRegistry { onWritten(editor.file, "{\"edited\":1}") }
        assertFalse(h.onRegistry { isDirty(entry) })
        h.relay(editor, add(1))
        assertTrue(h.onRegistry { isDirty(entry) })
    }

    @Test
    fun `keeps the mirror for a save that changed nothing, which settles the change and dirties nothing`() {
        val h = harness(timings = PATIENT_TIMINGS)
        val editor = h.openReady(A, "{ \"older\": \"bytes\" }")
        val entry = h.entry(A)
        h.relay(editor, add(1, "settings.scrollTo"))
        assertTrue(h.onRegistry { isDirty(entry) })

        h.save(editor, null)

        assertFalse(h.onRegistry { isDirty(entry) })
        assertEquals(
            "{ \"older\": \"bytes\" }",
            h.join(A, RecordingConnection()).get("initialValue").textValue()
        )
    }

    @Test
    fun `closes a file open under two names for a peer of both, which still tracks its other file`() {
        val h = harness()
        h.addFile(A)
        h.env.links["$WS/link.erd"] = A
        val direct = h.openReady(A)
        val linked = h.ready(h.open("$WS/link.erd"), disk = "{}")
        h.openReady(B)
        val both = RecordingConnection(1)
        val twice = RecordingConnection(2)
        h.onRegistry {
            for (entry in documents()) join(entry, both).afterResponse()
            for (entry in documents().filter { it.path == A }) join(entry, twice).afterResponse()
        }

        h.onRegistry {
            removeView(direct.file, direct.view)
            removeView(linked.file, linked.view)
        }

        assertEquals(listOf(A, A), both.closedSent())
        assertEquals(listOf(A, A), twice.closedSent())
        assertEquals(listOf(both), h.onRegistry { shutdown() })
        assertEquals(listOf(A, A, B), both.closedSent())
    }

    @Test
    fun `answers an open wait made after the hub's threads stopped once it is cancelled`() {
        val h = harness()
        h.threads.shutdown(2_000)

        // No registry thread is left, so the test's own thread stands in for it.
        val wait = h.registry.waitForReady(A, 10)
        wait.cancel()

        assertEquals(ReadyOutcome.Cancelled, runBlocking { wait.await() })
    }

    @Test
    fun `serves callers off the registry thread`() {
        val h = harness()
        h.openReady(A)
        val posted = CopyOnWriteArrayList<Int>()

        h.registry.post { posted += documents().size }
        assertEquals(1, runBlocking { h.registry.call { documents().size } })
        assertEquals(1, h.registry.callBlocking(5_000) { documents().size })
        assertEquals(listOf(1), posted)
    }

    @Test
    fun `sends a peer's own closed documents as notifications addressed by path`() {
        val h = harness()
        val editor = h.openReady(A)
        val peer = RecordingConnection()
        h.join(A, peer)

        h.onRegistry { removeView(editor.file, editor.view) }

        assertTrue(peer.notifications.single() is HubNotification.DocumentClosed)
    }

    private fun awaitResolved(h: DocumentHarness, path: String) {
        awaitUntil(message = "$path resolved") { h.onRegistry { find(path)?.resolved == true } }
    }

    private companion object {
        const val A = "$WS/a.erd"
        const val B = "$WS/b.erd"
        const val C = "$WS/c.erd"
        const val P1 = "/p1/a.erd"
        const val P2 = "/p2/b.erd"
        const val DOC = "/docs/a.erd"
    }
}
