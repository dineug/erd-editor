package com.github.dineug.erdeditorintellijplugin.hub

/** The protocol this hub speaks; a hello with any other version is refused. */
const val HUB_PROTOCOL_VERSION: Int = 1

/**
 * The largest frame either side accepts, in UTF-8 bytes without the newline. A join result carries
 * a whole document as one JSON string, hence the room.
 */
const val MAX_FRAME_BYTES: Int = 64 * 1024 * 1024

/** The error codes of packages/agent-hub's protocol.ts, in its order; the wire spelling is case-sensitive. */
enum class HubErrorCode(val wire: String) {
    PROTOCOL_MISMATCH("protocolMismatch"),
    UNAUTHORIZED("unauthorized"),
    OUTSIDE_WORKSPACE("outsideWorkspace"),
    NOT_FOUND("notFound"),
    NOT_OPEN("notOpen"),
    READONLY("readonly"),
    HUB_DISABLED("hubDisabled"),
    BAD_REQUEST("badRequest"),
    INTERNAL("internal"),
}

/** A refusal a handler or the server answers as {code, message}; no stack trace. */
open class HubRequestError(val code: HubErrorCode, message: String) :
    RuntimeException(message, null, false, false)

/** The methods a peer may call after its hello; [carriesPath] marks those the hub authorizes. */
enum class HubMethod(val wire: String, val carriesPath: Boolean) {
    LIST_DOCUMENTS("listDocuments", false),
    OPEN_DOCUMENT("openDocument", true),
    JOIN("join", true),
    APPLY_ACTIONS("applyActions", true),
    LEAVE("leave", true),
    SAVE("save", true);

    companion object {
        /**
         * The routed method spelled exactly [method], or null: a second "hello" and a prototype key
         * such as "toString" are unknown methods, as the TypeScript own-property check has them.
         */
        fun routed(method: String): HubMethod? = entries.firstOrNull { it.wire == method }
    }
}

/** The fixed texts the connection side answers with, verbatim from packages/agent-hub-host. */
object HubTexts {
    const val UNAUTHORIZED = "The hello token does not match the lock file of this window"
    const val NEEDS_ACTIONS = "applyActions needs an array params.actions"

    fun noMethod(method: String): String = "The hub has no method ${HubJson.quote(method)}"

    fun needsPath(method: String): String = "$method needs a string params.path"

    /** Names both versions and the side that is behind, which is the side to update. */
    fun protocolMismatch(hub: Double, client: Double): String {
        val action = if (hub < client) {
            "Update the ERD Editor extension or plugin in the editor until its hub speaks protocol " +
                HubJson.jsNumber(client)
        } else {
            "Update the MCP server (npx -y @dineug/erd-editor-mcp@latest) until it speaks protocol " +
                HubJson.jsNumber(hub)
        }
        return "The ERD Editor hub speaks protocol ${HubJson.jsNumber(hub)} but the client speaks " +
            "protocol ${HubJson.jsNumber(client)}. $action."
    }

    fun noRealPath(target: String): String =
        "$target has no real path the hub can check, such as a dangling link"

    fun outsideWorkspace(real: String): String =
        "$real is neither inside a workspace folder nor an open document"
}
