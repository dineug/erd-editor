package com.github.dineug.erdeditorintellijplugin.hub.server

import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.encodeFrame
import java.util.concurrent.CompletableFuture

/** One authenticated peer; identity-stable; compared by identity (no equals override). */
interface HubConnection {
    val id: Int
    val client: String

    /**
     * Enqueues after every frame already queued; dropped once the connection stopped serving;
     * an encoding failure logs "request failed" and drops. Callable from any thread.
     */
    fun notify(notification: HubNotification)

    /** Completes once every frame queued before the call was written or refused, or writing stopped. */
    fun drain(): CompletableFuture<Unit>

    /** Graceful end: stops serving, lets queued frames out, then ends the stream. Idempotent. */
    fun end()
}

/** One instance per batch goes to every peer; its frame is encoded once, on first use. */
sealed interface HubNotification {
    val path: String

    /** encodeFrame(HubResults.notification(this)); a failure rethrows on each access (notify logs and drops). */
    val frame: Lazy<ByteArray>

    class Actions(override val path: String, val actions: ArrayNode) : HubNotification {
        override val frame: Lazy<ByteArray> = lazy { encodeFrame(HubResults.notification(this)) }
    }

    class DocumentClosed(override val path: String) : HubNotification {
        override val frame: Lazy<ByteArray> = lazy { encodeFrame(HubResults.notification(this)) }
    }
}

/** openDocument's params after authorization: create by JavaScript truthiness, initialValue only when a string. */
data class OpenParams(val path: String, val create: Boolean, val initialValue: String?)

/** The params of join, leave and save after authorization. */
data class PathParams(val path: String)

/** applyActions' params after authorization; the actions are relayed as they came, nulls included. */
data class ApplyParams(val path: String, val actions: ArrayNode)

/** afterResponse runs on the registry thread right after the response frame was enqueued. */
class HandlerResult(val result: ObjectNode, val afterResponse: (() -> Unit)? = null)

/**
 * The document side the connection server hands each routed request, with the path already the
 * authorized real path. A method answers its result or throws HubRequestError; anything else the
 * server answers internal. Every method runs in a coroutine on HubThreads.registry, started in
 * frame order.
 */
interface HubHandler {
    suspend fun listDocuments(params: ObjectNode, connection: HubConnection): HandlerResult
    suspend fun openDocument(params: OpenParams, connection: HubConnection): HandlerResult
    suspend fun join(params: PathParams, connection: HubConnection): HandlerResult
    suspend fun applyActions(params: ApplyParams, connection: HubConnection): HandlerResult
    suspend fun leave(params: PathParams, connection: HubConnection): HandlerResult
    suspend fun save(params: PathParams, connection: HubConnection): HandlerResult

    /** Called once per authenticated connection, on the registry thread. */
    fun disconnect(connection: HubConnection)
}
