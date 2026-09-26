package com.github.dineug.erdeditorintellijplugin.hub.server

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.HUB_PROTOCOL_VERSION
import com.github.dineug.erdeditorintellijplugin.hub.HubErrorCode
import com.github.dineug.erdeditorintellijplugin.hub.HubJson

/**
 * Every result, response and notification the hub writes, keys in the order of packages/agent-hub's
 * protocol.ts schemas: the VS Code and Obsidian hosts write that order, and the conformance corpus
 * pins their bytes.
 */
object HubResults {
    private val nodes = HubJson.nodes

    fun documentInfo(path: String, open: Boolean, active: Boolean, dirty: Boolean, readonly: Boolean): ObjectNode =
        nodes.objectNode()
            .put("path", path)
            .put("open", open)
            .put("active", active)
            .put("dirty", dirty)
            .put("readonly", readonly)

    /** {"documents":[…]} */
    fun listDocuments(documents: List<ObjectNode>): ObjectNode =
        nodes.objectNode().also { it.putArray("documents").addAll(documents) }

    fun openDocument(path: String, opened: Boolean, webviews: Int): ObjectNode =
        nodes.objectNode().put("path", path).put("opened", opened).put("webviews", webviews)

    fun join(initialValue: String, snapshotVersion: Double, readonly: Boolean): ObjectNode =
        nodes.objectNode()
            .put("initialValue", initialValue)
            .put("snapshotVersion", snapshotVersion)
            .put("readonly", readonly)

    fun applyActions(webviews: Int): ObjectNode = nodes.objectNode().put("webviews", webviews)

    /** {} */
    fun leave(): ObjectNode = nodes.objectNode()

    fun save(saved: Boolean): ObjectNode = nodes.objectNode().put("saved", saved)

    /** {"protocolVersion":1,"ide":…,"version":…} */
    fun hello(ide: String, version: String): ObjectNode =
        nodes.objectNode().put("protocolVersion", HUB_PROTOCOL_VERSION).put("ide", ide).put("version", version)

    /** {"id":…,"ok":true,"method":…,"result":…}; the id echoed as JavaScript prints it (1.0 → 1). */
    fun response(id: Double, method: String, result: JsonNode): String =
        head(id, true, method) + ",\"result\":" + HubJson.stringify(result) + "}"

    /** {"id":…,"ok":false,"method":…,"error":{"code","message"}}, both versions only on a protocolMismatch. */
    fun errorResponse(
        id: Double,
        method: String,
        code: HubErrorCode,
        message: String,
        hubProtocolVersion: Double? = null,
        clientProtocolVersion: Double? = null,
    ): String {
        val error = nodes.objectNode().put("code", code.wire).put("message", message)
        if (hubProtocolVersion != null) error.put("hubProtocolVersion", hubProtocolVersion)
        if (clientProtocolVersion != null) error.put("clientProtocolVersion", clientProtocolVersion)
        return head(id, false, method) + ",\"error\":" + HubJson.stringify(error) + "}"
    }

    /** {"method":…,"params":{"path":…[,"actions":…]}}, never an id key: a peer reads one with an id as an answer. */
    fun notification(notification: HubNotification): String {
        val params = nodes.objectNode().put("path", notification.path)
        val method = when (notification) {
            is HubNotification.Actions -> "actions".also { params.set<JsonNode>("actions", notification.actions) }
            is HubNotification.DocumentClosed -> "documentClosed"
        }
        return "{\"method\":" + HubJson.quote(method) + ",\"params\":" + HubJson.stringify(params) + "}"
    }

    private fun head(id: Double, ok: Boolean, method: String): String =
        "{\"id\":" + HubJson.stringify(nodes.numberNode(id)) + ",\"ok\":$ok,\"method\":" + HubJson.quote(method)
}
