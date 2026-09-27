package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.HubMethod
import com.github.dineug.erdeditorintellijplugin.hub.server.ApplyParams
import com.github.dineug.erdeditorintellijplugin.hub.server.HandlerResult
import com.github.dineug.erdeditorintellijplugin.hub.server.HubConnection
import com.github.dineug.erdeditorintellijplugin.hub.server.HubHandler
import com.github.dineug.erdeditorintellijplugin.hub.server.HubResults
import com.github.dineug.erdeditorintellijplugin.hub.server.OpenParams
import com.github.dineug.erdeditorintellijplugin.hub.server.PathParams
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CopyOnWriteArrayList

/**
 * A handler that records every call, in the order the hub made them, and answers as
 * agent-hub-host's createHubHandler does: an empty listing, an open that opened, a join from '{}',
 * one webview, {} and a save that saved. answer replaces a method's answer; answerOnce answers
 * only its next call, to fail, throw or hang it on a CompletableDeferred.
 */
class RecordingHandler : HubHandler {
    /** One call: the params as the hub handed them over (an ObjectNode, OpenParams, PathParams or ApplyParams). */
    data class Call(val method: HubMethod, val params: Any, val connection: HubConnection)

    fun interface Answer {
        suspend fun answer(params: Any, connection: HubConnection): HandlerResult
    }

    private val recorded = CopyOnWriteArrayList<Call>()
    private val disconnected = CopyOnWriteArrayList<HubConnection>()
    private val once = ConcurrentHashMap<HubMethod, ConcurrentLinkedQueue<Answer>>()
    private val always = ConcurrentHashMap<HubMethod, Answer>()

    val calls: List<Call> get() = recorded.toList()

    /** Every connection disconnect was called with, in order. */
    val disconnects: List<HubConnection> get() = disconnected.toList()

    fun callsOf(method: HubMethod): List<Call> = recorded.filter { it.method == method }

    fun answer(method: HubMethod, answer: Answer) {
        always[method] = answer
    }

    fun answerOnce(method: HubMethod, answer: Answer) {
        once.getOrPut(method) { ConcurrentLinkedQueue() } += answer
    }

    override suspend fun listDocuments(params: ObjectNode, connection: HubConnection) =
        handle(HubMethod.LIST_DOCUMENTS, params, connection)

    override suspend fun openDocument(params: OpenParams, connection: HubConnection) =
        handle(HubMethod.OPEN_DOCUMENT, params, connection)

    override suspend fun join(params: PathParams, connection: HubConnection) = handle(HubMethod.JOIN, params, connection)

    override suspend fun applyActions(params: ApplyParams, connection: HubConnection) =
        handle(HubMethod.APPLY_ACTIONS, params, connection)

    override suspend fun leave(params: PathParams, connection: HubConnection) = handle(HubMethod.LEAVE, params, connection)

    override suspend fun save(params: PathParams, connection: HubConnection) = handle(HubMethod.SAVE, params, connection)

    override fun disconnect(connection: HubConnection) {
        disconnected += connection
    }

    private suspend fun handle(method: HubMethod, params: Any, connection: HubConnection): HandlerResult {
        recorded += Call(method, params, connection)
        val answer = once[method]?.poll() ?: always[method] ?: return HandlerResult(defaultResult(method, params))
        return answer.answer(params, connection)
    }

    companion object {
        /** What createHubHandler answers each method with. */
        fun defaultResult(method: HubMethod, params: Any): ObjectNode = when (method) {
            HubMethod.LIST_DOCUMENTS -> HubResults.listDocuments(emptyList())
            HubMethod.OPEN_DOCUMENT -> HubResults.openDocument((params as OpenParams).path, true, 1)
            HubMethod.JOIN -> HubResults.join("{}", 0.0, false)
            HubMethod.APPLY_ACTIONS -> HubResults.applyActions(1)
            HubMethod.LEAVE -> HubResults.leave()
            HubMethod.SAVE -> HubResults.save(true)
        }
    }
}
