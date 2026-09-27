package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.fasterxml.jackson.databind.node.ArrayNode
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.server.HubConnection
import com.github.dineug.erdeditorintellijplugin.hub.server.HubNotification
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArrayList

/**
 * A HubConnection that keeps every notification it is sent, as the Obsidian suites' connection
 * double does. Like a served connection, it drops what arrives after end(); drain completes at once
 * unless a suite sets drained.
 */
class RecordingConnection(override val id: Int = 1, override val client: String = "spec") : HubConnection {
    private val recorded = CopyOnWriteArrayList<HubNotification>()

    /** Every notification sent before the end, in order. */
    val notifications: List<HubNotification> get() = recorded.toList()

    @Volatile
    var ended: Boolean = false
        private set

    @Volatile
    var endCalls: Int = 0
        private set

    override fun notify(notification: HubNotification) {
        if (!ended) recorded += notification
    }

    /** What drain answers; completed unless a suite sets another. */
    @Volatile
    var drained: CompletableFuture<Unit> = CompletableFuture.completedFuture(Unit)

    override fun drain(): CompletableFuture<Unit> = drained

    override fun end() {
        endCalls++
        ended = true
    }

    /** The action arrays of the actions notifications, in order. */
    fun actionsSent(): List<ArrayNode> = notifications.filterIsInstance<HubNotification.Actions>().map { it.actions }

    /** The same, each written as JSON, for comparing with a literal. */
    fun actionsText(): List<String> = actionsSent().map(HubJson::stringify)

    /** The paths of the documentClosed notifications, in order. */
    fun closedSent(): List<String> =
        notifications.filterIsInstance<HubNotification.DocumentClosed>().map { it.path }

    override fun toString(): String = "RecordingConnection($id)"
}
