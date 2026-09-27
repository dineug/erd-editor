package com.github.dineug.erdeditorintellijplugin.hub.document

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ArrayNode
import com.github.dineug.erdeditorintellijplugin.hub.HubClock
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.github.dineug.erdeditorintellijplugin.hub.server.HubConnection
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.ceil

/** Where an action reached the hub from; drops at a join are counted per source, by its wire name. */
enum class ActionSource(val wire: String) { WEBVIEW("webview"), PEER("peer") }

/** One delivery held back while its peer was inside the join window. */
class QueuedBatch(val source: ActionSource, val actions: ArrayNode)

/** A joined agent peer of one document; deliveries wait in queue while it is inside its join window, null after. */
class JoinPeer(val connection: HubConnection) {
    var queue: MutableList<QueuedBatch>? = mutableListOf()
}

/**
 * Whether a document is between a change and the replica saves it causes. Every view the change
 * reached runs its own replica, so the last of their saves, not the first, makes the content current.
 * Not thread-safe: the registry thread owns it.
 */
class QuietState<V : Any> {
    var pending: Boolean = false

    /** The ready views the pending change went to, copied as it was noted; each owes one save. */
    val awaiting: MutableSet<V> = LinkedHashSet()
    var saves: Int = 0

    /** A save reaching the hub before this instant was sent before its replica held the latest peer batch. */
    var countFrom: Double = Double.NEGATIVE_INFINITY

    /** Completed by the save that settles the pending change; null while none is pending. */
    var settled: CompletableDeferred<Unit>? = null
}

/** packages/agent-hub-host's joinWindow.ts: the action readers, the quiet state and the queue filter. */
object JoinWindow {
    /** Shared action types that change no document byte, so no replica save follows them. */
    val NON_CHANGE_ACTION_TYPES: Set<String> = setOf(
        "editor.getLWW",
        "editor.mergeLWW",
        "editor.sharedMouseTracker",
        "editor.sharedFocusTracker",
        "editor.sharedSelectionTracker",
        "editor.sharedDragSelectTracker",
    )

    private const val UNKNOWN_TYPE = "unknown"

    /** The Lamport version an action carries, or null: a finite number on an object, nothing else. */
    fun actionVersion(action: JsonNode?): Double? {
        if (action == null || !action.isObject) return null
        val version = action.get("version")
        if (version == null || !version.isNumber) return null
        // A number beyond the double range reads as infinite, which Number.isFinite refuses too.
        val value = version.asDouble()
        return if (value.isFinite()) value else null
    }

    fun actionType(action: JsonNode?): String {
        if (action == null || !action.isObject) return UNKNOWN_TYPE
        val type = action.get("type")
        return if (type != null && type.isTextual) type.textValue() else UNKNOWN_TYPE
    }

    /** Anything not known to leave the bytes alone counts, so a stranger only costs a wait. */
    fun hasChangeAction(actions: ArrayNode): Boolean = actions.any { actionType(it) !in NON_CHANGE_ACTION_TYPES }

    /** The highest version among current and the actions; a version-less action is skipped. */
    fun maxVersion(current: Double, actions: ArrayNode): Double =
        actions.fold(current) { max, action -> maxOf(max, actionVersion(action) ?: max) }

    /**
     * The hub sends a peer batch at now, so a save holding it cannot arrive within the replica
     * debounce. A relay can reach the hub after its replica saved, as both leave the view at once,
     * so a relay bounds nothing.
     */
    fun <V : Any> noteChange(
        state: QuietState<V>,
        source: ActionSource,
        now: Double,
        recipients: Collection<V>,
        replicaDebounceMs: Long,
    ) {
        state.pending = true
        state.saves = 0
        state.awaiting.clear()
        state.awaiting.addAll(recipients)
        if (state.settled == null) state.settled = CompletableDeferred()
        if (source == ActionSource.PEER) state.countFrom = maxOf(state.countFrom, now + replicaDebounceMs)
    }

    /**
     * A save outside a pending change, or too early to hold the latest peer batch, is ignored. One
     * from a view the change never reached settles nothing on its own, since every awaited save is still owed.
     */
    fun <V : Any> noteSave(state: QuietState<V>, view: V, now: Double) {
        if (!state.pending || now < state.countFrom) return
        state.saves++
        state.awaiting.remove(view)
        settle(state)
    }

    /** A closed view owes no save, so its removal can settle a change the views left have saved. */
    fun <V : Any> dropRecipient(state: QuietState<V>, view: V) {
        state.awaiting.remove(view)
        settle(state)
    }

    /** True at once when no change is pending or on the save that settles it, false at capMs. */
    suspend fun <V : Any> waitForQuiet(state: QuietState<V>, capMs: Long): Boolean {
        val settled = state.settled
        if (!state.pending || settled == null) return true
        return withTimeoutOrNull(capMs) { settled.await() } != null
    }

    /**
     * Waits for quiet, capMs at most in all. The wait resumes a dispatch after the save that
     * settled it, and a change landing in between would be dropped by the queue filter, so it waits again.
     */
    suspend fun <V : Any> waitUntilQuiet(state: QuietState<V>, capMs: Long, clock: HubClock) {
        val deadline = clock.nowMs() + capMs
        var settled = waitForQuiet(state, capMs)
        while (settled && state.pending) {
            val left = deadline - clock.nowMs()
            if (left <= 0) return
            settled = waitForQuiet(state, ceil(left).toLong())
        }
    }

    /** What filterJoinQueue kept, and what it dropped counted by source, then by action type. */
    class Filtered(
        val batches: List<QueuedBatch>,
        val dropped: Map<ActionSource, Map<String, Int>>,
        val droppedCount: Int,
    )

    /**
     * Filters what was queued before the snapshot: what it holds (version up to snapshotVersion)
     * goes, and so does a version-less action, since a relative move applied twice moves twice.
     */
    fun filterJoinQueue(queue: List<QueuedBatch>, snapshotVersion: Double): Filtered {
        val batches = ArrayList<QueuedBatch>()
        val dropped = LinkedHashMap<ActionSource, MutableMap<String, Int>>()
        var droppedCount = 0
        for (batch in queue) {
            val kept = HubJson.nodes.arrayNode()
            for (action in batch.actions) {
                val version = actionVersion(action)
                if (version != null && version > snapshotVersion) {
                    kept.add(action)
                } else {
                    dropped.getOrPut(batch.source) { LinkedHashMap() }.merge(actionType(action), 1, Int::plus)
                    droppedCount++
                }
            }
            if (!kept.isEmpty) batches += QueuedBatch(batch.source, kept)
        }
        return Filtered(batches, dropped, droppedCount)
    }

    /**
     * What a join window hands its peer once it ends. Only the first captured batches predate the
     * snapshot and are filtered, a drop logged; a batch queued after the capture goes out whole.
     */
    fun drainJoinQueue(
        queue: List<QueuedBatch>,
        captured: Int,
        snapshotVersion: Double,
        path: String,
        log: HubLog,
    ): List<QueuedBatch> {
        val filtered = filterJoinQueue(queue.subList(0, captured), snapshotVersion)
        if (filtered.droppedCount > 0) {
            log.warn(
                "dropped ${filtered.droppedCount} queued actions joining $path: versioned at most " +
                    "${HubJson.jsNumber(snapshotVersion)}, or unversioned",
                filtered.dropped.mapKeys { it.key.wire },
            )
        }
        return filtered.batches + queue.subList(captured, queue.size)
    }

    /** Settles once every awaited view has saved or gone and at least one save came. */
    private fun <V : Any> settle(state: QuietState<V>) {
        if (!state.pending || state.awaiting.isNotEmpty() || state.saves < 1) return
        state.pending = false
        val settled = state.settled
        state.settled = null
        settled?.complete(Unit)
    }
}
