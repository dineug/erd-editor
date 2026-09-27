package com.github.dineug.erdeditorintellijplugin.hub.document

import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeClock
import com.github.dineug.erdeditorintellijplugin.hub.testing.JoinWindowCorpus
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout

/**
 * The join window of packages/agent-hub-host's joinWindow.ts: the action readers, the queue filter
 * and drain from the shared corpus, and the quiet state's cases of its joinWindow.test.ts. The
 * waits run in runBlocking's one thread, as the registry thread runs them.
 */
class JoinWindowTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    private val corpus = Corpus.host.joinWindow
    private val first = "first"
    private val second = "second"

    @Test
    fun `holds the replica debounce, the join cap and the action types that change nothing`() {
        assertEquals(corpus.replicaDebounceMs, HubTimings().replicaDebounceMs)
        assertEquals(corpus.joinQuietCapMs, HubTimings().joinQuietCapMs)
        assertEquals(corpus.nonChangeTypes.toSet(), JoinWindow.NON_CHANGE_ACTION_TYPES)
        for (type in corpus.nonChangeTypes) {
            assertFalse(JoinWindow.hasChangeAction(batch("{\"type\":\"$type\"}")))
        }
    }

    @Test
    fun `reads an action's version and type`() {
        for (case in corpus.actionVersion) {
            assertEquals("version of ${case.action}", case.version, JoinWindow.actionVersion(case.action))
        }
        for (case in corpus.actionType) {
            assertEquals("type of ${case.action}", case.type, JoinWindow.actionType(case.action))
        }
        // JSON holds neither NaN nor infinity; a number beyond the double range reads as infinite.
        assertNull(JoinWindow.actionVersion(HubJson.nodes.objectNode().put("version", Double.NaN)))
        assertNull(JoinWindow.actionVersion(HubJson.parse("{\"version\":1e400}")))
        assertNull(JoinWindow.actionVersion(null))
        assertEquals("unknown", JoinWindow.actionType(null))
    }

    @Test
    fun `counts a change and raises the version`() {
        for (case in corpus.hasChangeAction) {
            assertEquals("${case.actions}", case.result, JoinWindow.hasChangeAction(case.actions))
        }
        for (case in corpus.maxVersion) {
            assertEquals("${case.actions}", case.result, JoinWindow.maxVersion(case.current, case.actions), 0.0)
        }
    }

    @Test
    fun `filters a queue at the snapshot, counting drops by source and type`() {
        for (case in corpus.filterJoinQueue) {
            val filtered = JoinWindow.filterJoinQueue(case.queue.map(::queued), case.snapshotVersion)
            assertEquals(case.batches.map(::text), filtered.batches.map(::text))
            assertEquals(case.dropped, filtered.dropped.mapKeys { it.key.wire })
            assertEquals(case.droppedCount, filtered.droppedCount)
        }
    }

    @Test
    fun `drains the captured batches through the filter and the later ones whole, logging a drop`() {
        for (case in corpus.drainJoinQueue) {
            val log = RecordingLog()
            val drained = JoinWindow.drainJoinQueue(
                case.queue.map(::queued), case.captured, case.snapshotVersion, case.path, log,
            )
            assertEquals(case.batches.map(::text), drained.map(::text))
            val warning = case.warning
            assertEquals(if (warning == null) emptyList() else listOf(warning.text to warning.dropped), log.lines)
        }
    }

    @Test
    fun `resolves true at once with no change pending`() = runBlocking {
        val state = QuietState<String>()
        JoinWindow.noteSave(state, "only", 0.0)

        assertTrue(JoinWindow.waitForQuiet(state, 10_000))
        assertFalse(state.pending)
    }

    @Test
    fun `wakes on the last save of the views the change reached, not on another view`() = runBlocking {
        val state = QuietState<String>()
        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, listOf(first, second), DEBOUNCE)
        val woken = async { JoinWindow.waitForQuiet(state, 10_000) }
        turns()

        JoinWindow.noteSave(state, "other", 0.0)
        turns()
        assertFalse(woken.isCompleted)
        assertEquals(setOf(first, second), state.awaiting)

        JoinWindow.noteSave(state, first, 0.0)
        turns()
        assertFalse(woken.isCompleted)

        JoinWindow.noteSave(state, second, 0.0)
        assertTrue(woken.await())
        assertNull(state.settled)
    }

    @Test
    fun `awaits the views of the newest change when another lands mid-wait, owing it a save of its own`() =
        runBlocking {
            val state = QuietState<String>()
            JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, listOf(first, second), DEBOUNCE)
            val woken = async { JoinWindow.waitForQuiet(state, 10_000) }
            turns()

            JoinWindow.noteSave(state, first, 0.0)
            JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, listOf(first, second), DEBOUNCE)
            assertEquals(0, state.saves)
            JoinWindow.noteSave(state, first, 0.0)
            turns()
            assertFalse(woken.isCompleted)

            JoinWindow.noteSave(state, second, 0.0)
            assertTrue(woken.await())
        }

    @Test
    fun `ignores a save sent before its replica could hold the latest peer batch`() {
        val state = QuietState<String>()
        JoinWindow.noteChange(state, ActionSource.PEER, 1_000.0, listOf("only"), DEBOUNCE)

        JoinWindow.noteSave(state, "only", 1_000.0 + DEBOUNCE - 1)
        assertTrue(state.pending)
        JoinWindow.noteSave(state, "only", 1_000.0 + DEBOUNCE)
        assertFalse(state.pending)
    }

    @Test
    fun `keeps the bound of a peer batch through a later relay, which sets none of its own`() {
        val state = QuietState<String>()
        JoinWindow.noteChange(state, ActionSource.PEER, 1_000.0, listOf("only"), DEBOUNCE)
        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 1_100.0, listOf("only"), DEBOUNCE)

        JoinWindow.noteSave(state, "only", 1_150.0)
        assertTrue(state.pending)
        JoinWindow.noteSave(state, "only", 1_000.0 + DEBOUNCE)
        assertFalse(state.pending)

        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 5_000.0, listOf("only"), DEBOUNCE)
        JoinWindow.noteSave(state, "only", 5_000.0)
        assertFalse(state.pending)
    }

    @Test
    fun `expects one save even with no ready view, and resolves false at the cap`() = runBlocking {
        val state = QuietState<String>()
        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, emptyList(), DEBOUNCE)
        val started = System.nanoTime()

        assertFalse(JoinWindow.waitForQuiet(state, CAP_MS))
        assertTrue(elapsedMs(started) >= CAP_MS)
        assertTrue(state.pending)

        JoinWindow.noteSave(state, "late", 0.0)
        assertFalse(state.pending)
    }

    @Test
    fun `settles when the view still owing a save closes after the other saved`() = runBlocking {
        val state = QuietState<String>()
        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, listOf(first, second), DEBOUNCE)
        val woken = async { JoinWindow.waitForQuiet(state, 10_000) }
        turns()

        JoinWindow.noteSave(state, second, 0.0)
        turns()
        assertFalse(woken.isCompleted)

        JoinWindow.dropRecipient(state, first)
        assertTrue(woken.await())
        assertNull(state.settled)
        JoinWindow.dropRecipient(state, first)
        assertFalse(state.pending)
    }

    @Test
    fun `keeps waiting when every view owing a save closes without one, then takes a later save`() = runBlocking {
        val state = QuietState<String>()
        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, listOf(first, second), DEBOUNCE)
        val woken = async { JoinWindow.waitForQuiet(state, 10_000) }
        turns()

        JoinWindow.dropRecipient(state, first)
        JoinWindow.dropRecipient(state, second)
        turns()
        assertFalse(woken.isCompleted)
        assertTrue(state.pending)

        JoinWindow.noteSave(state, "reopened", 0.0)
        assertTrue(woken.await())
    }

    @Test
    fun `settles a change whose waiter was taken away`() = runBlocking {
        val state = QuietState<String>()
        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, listOf(first), DEBOUNCE)
        state.settled = null

        assertTrue(JoinWindow.waitForQuiet(state, 10_000))
        JoinWindow.noteSave(state, first, 0.0)

        assertFalse(state.pending)
    }

    @Test
    fun `waits until quiet at once when nothing is pending`() = runBlocking {
        val state = QuietState<String>()
        val clock = FakeClock()

        JoinWindow.waitUntilQuiet(state, 10_000, clock)

        assertFalse(state.pending)
    }

    @Test
    fun `waits again for a change noted between the settle and the resume`() = runBlocking {
        val state = QuietState<String>()
        val clock = FakeClock()
        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, listOf(first), DEBOUNCE)
        val waiting = async { JoinWindow.waitUntilQuiet(state, 10_000, clock) }
        turns()

        settleWithChangeBehind(state)
        turns()
        assertFalse(waiting.isCompleted)
        assertTrue(state.pending)

        JoinWindow.noteSave(state, first, 0.0)
        waiting.await()
        assertFalse(state.pending)
    }

    @Test
    fun `gives up at the cap when the change behind the settle is never saved`() = runBlocking {
        val state = QuietState<String>()
        val clock = FakeClock()
        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, listOf(first), DEBOUNCE)
        val waiting = async { JoinWindow.waitUntilQuiet(state, CAP_MS, clock) }
        turns()

        settleWithChangeBehind(state)
        clock.advance(CAP_MS / 2.0)
        waiting.await()

        assertTrue(state.pending)
    }

    @Test
    fun `stops at once when the settle resumes after the cap already passed`() = runBlocking {
        val state = QuietState<String>()
        val clock = FakeClock()
        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, listOf(first), DEBOUNCE)
        val waiting = async { JoinWindow.waitUntilQuiet(state, 10_000, clock) }
        turns()

        clock.advance(10_001.0)
        settleWithChangeBehind(state)
        waiting.await()

        assertTrue(state.pending)
    }

    /** Wakes the wait as a save would, with a newer change already noted behind it. */
    private fun settleWithChangeBehind(state: QuietState<String>) {
        val settled = checkNotNull(state.settled)
        state.settled = null
        JoinWindow.noteChange(state, ActionSource.WEBVIEW, 0.0, listOf(first), DEBOUNCE)
        settled.complete(Unit)
    }

    private fun queued(batch: JoinWindowCorpus.Batch) = QueuedBatch(source(batch.source), batch.actions)

    private fun text(batch: JoinWindowCorpus.Batch) = batch.source + HubJson.stringify(batch.actions)

    private fun text(batch: QueuedBatch) = batch.source.wire + HubJson.stringify(batch.actions)

    private fun source(wire: String) = ActionSource.entries.single { it.wire == wire }

    private suspend fun CoroutineScope.turns() = repeat(10) { yield() }

    private fun elapsedMs(started: Long) = (System.nanoTime() - started) / 1_000_000

    private companion object {
        const val DEBOUNCE = 200L
        const val CAP_MS = 120L
    }
}
