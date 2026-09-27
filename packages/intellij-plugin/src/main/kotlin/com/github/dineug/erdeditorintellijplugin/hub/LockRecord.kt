package com.github.dineug.erdeditorintellijplugin.hub

import com.fasterxml.jackson.databind.JsonNode

/**
 * One hub's lock, the fields in the order serializeLock writes them. pipe and token are empty and
 * hub false when the hub does not serve: the lock still guards its paths.
 */
data class LockRecord(
    val pipe: String,
    val workspaceFolders: List<String>,
    val documents: List<String>,
    val ide: String,
    val version: String,
    val protocolVersion: Long,
    val token: String,
    val hub: Boolean,
)

/**
 * JSON.stringify(record, null, 2) + "\n": fixed key order, two-space indent, each array element
 * on its own line and "[]" for an empty array, so equal records write equal bytes (hand-written,
 * as Jackson's pretty printer spaces arrays differently).
 */
fun serializeLock(record: LockRecord): String = buildString {
    append("{\n")
    append("  \"pipe\": ").append(HubJson.quote(record.pipe)).append(",\n")
    append("  \"workspaceFolders\": ").append(pathList(record.workspaceFolders)).append(",\n")
    append("  \"documents\": ").append(pathList(record.documents)).append(",\n")
    append("  \"ide\": ").append(HubJson.quote(record.ide)).append(",\n")
    append("  \"version\": ").append(HubJson.quote(record.version)).append(",\n")
    append("  \"protocolVersion\": ").append(record.protocolVersion).append(",\n")
    append("  \"token\": ").append(HubJson.quote(record.token)).append(",\n")
    append("  \"hub\": ").append(record.hub).append("\n")
    append("}\n")
}

private fun pathList(paths: List<String>): String =
    if (paths.isEmpty()) "[]" else paths.joinToString(",\n", "[\n", "\n  ]") { "    ${HubJson.quote(it)}" }

/**
 * Strict on types, unknown keys dropped, so a newer writer's lock still parses; a BOM gives null,
 * as JSON.parse refuses it, and protocolVersion must be a safe integer (1.0 passes).
 */
fun parseLock(raw: String): LockRecord? {
    val node = try {
        HubJson.parse(raw)
    } catch (e: JsonNotParsed) {
        return null
    }
    if (!HubJson.isRecord(node)) return null
    return LockRecord(
        pipe = node.text("pipe") ?: return null,
        workspaceFolders = node.texts("workspaceFolders") ?: return null,
        documents = node.texts("documents") ?: return null,
        ide = node.text("ide") ?: return null,
        version = node.text("version") ?: return null,
        protocolVersion = node.get("protocolVersion")
            ?.takeIf(HubJson::isSafeInteger)?.asDouble()?.toLong() ?: return null,
        token = node.text("token") ?: return null,
        hub = node.get("hub")?.takeIf(JsonNode::isBoolean)?.booleanValue() ?: return null,
    )
}

private fun JsonNode.text(key: String): String? = get(key)?.takeIf(JsonNode::isTextual)?.textValue()

private fun JsonNode.texts(key: String): List<String>? {
    val array = get(key)?.takeIf(JsonNode::isArray) ?: return null
    return array.map { if (it.isTextual) it.textValue() else return null }
}
