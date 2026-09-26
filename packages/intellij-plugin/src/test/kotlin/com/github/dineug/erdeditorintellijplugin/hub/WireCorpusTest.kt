package com.github.dineug.erdeditorintellijplugin.hub

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ArrayNode
import com.github.dineug.erdeditorintellijplugin.hub.server.HubNotification
import com.github.dineug.erdeditorintellijplugin.hub.server.HubResults
import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The frames of packages/agent-hub's conformance corpus, which the TypeScript hub is held to
 * too: what the hub writes must be those bytes, keys in schema order and numbers as JavaScript
 * prints them. The connection scenarios' expected frames of the host corpus are rebuilt here as
 * well, each result through its HubResults builder, since that and HubTexts are all the connection
 * server writes them with. The refused requests (W-11) are read here only as far as the accessors
 * the server's hand reader uses; how the server answers them is ConnectionServerTest's (R-*).
 */
class WireCorpusTest {
    private val wire = Corpus.wire
    private val server = Corpus.host.server

    @Test
    fun `speaks the corpus protocol, frame bound and error codes`() {
        assertEquals(HUB_PROTOCOL_VERSION, wire.protocolVersion)
        assertEquals(MAX_FRAME_BYTES, wire.maxFrameBytes)
        assertEquals(wire.errorCodes, HubErrorCode.entries.map { it.wire })
    }

    @Test
    fun `re-encodes every corpus frame to the same bytes`() {
        for (line in wire.requestFrames + wire.toPeerFrames) {
            assertEquals(line, HubJson.stringify(HubJson.parse(line)))
        }
    }

    @Test
    fun `writes every hub-to-peer frame of the corpus byte for byte`() {
        val closed = HubJson.parse("[{\"type\":\"memo.add\"}]") as ArrayNode
        val written = listOf(
            HubResults.response(1.0, "hello", HubResults.hello("vscode", "2.9.0")),
            HubResults.response(
                2.0,
                "listDocuments",
                HubResults.listDocuments(listOf(HubResults.documentInfo("/w/a.erd", true, false, false, false))),
            ),
            HubResults.response(3.0, "openDocument", HubResults.openDocument("/w/a.erd", true, 1)),
            HubResults.response(5.0, "join", HubResults.join("{}", 42.0, false)),
            HubResults.response(6.0, "applyActions", HubResults.applyActions(2)),
            HubResults.response(7.0, "leave", HubResults.leave()),
            HubResults.response(8.0, "save", HubResults.save(true)),
            HubResults.errorResponse(8.0, "save", HubErrorCode.NOT_OPEN, "no webview is ready"),
            HubResults.errorResponse(
                1.0, "hello", HubErrorCode.PROTOCOL_MISMATCH, HubTexts.protocolMismatch(1.0, 2.0), 1.0, 2.0,
            ),
            HubResults.notification(HubNotification.Actions("/w/a.erd", closed)),
            HubResults.notification(HubNotification.DocumentClosed("/w/a.erd")),
        )
        assertEquals(wire.toPeerFrames, written)
    }

    @Test
    fun `writes notifications in schema order without the fields it does not know`() {
        for (case in wire.encoderNormalization.filter { it.direction == "notification" }) {
            val params = case.input["params"]
            val notification = when (case.input["method"].textValue()) {
                "actions" -> HubNotification.Actions(params["path"].textValue(), params["actions"] as ArrayNode)
                else -> HubNotification.DocumentClosed(params["path"].textValue())
            }
            assertEquals(case.output, HubResults.notification(notification))
            assertEquals(case.output + "\n", String(notification.frame.value, Charsets.UTF_8))
        }
    }

    @Test
    fun `reads a normalized request as a projection of what was sent`() {
        for (case in wire.encoderNormalization.filter { it.direction == "request" }) {
            val output = HubJson.parse(case.output)
            assertEquals(case.output, HubJson.stringify(output))
            assertEquals(listOf("id", "method", "params"), output.properties().map { it.key })
            for (key in listOf("id", "method")) assertEquals(case.input[key], output[key])
            for ((key, value) in output["params"].properties()) assertEquals(case.input["params"][key], value)
        }
    }

    @Test
    fun `names the side to update on a protocol mismatch`() {
        for (case in wire.protocolMismatch) {
            assertEquals(case.message, HubTexts.protocolMismatch(case.hub, case.client))
        }
    }

    @Test
    fun `reads the frames a request schema refuses as the server's hand reader must`() {
        fun frame(text: String) = HubJson.parse(text)

        assertNull(HubMethod.routed(frame("{\"id\":1,\"method\":\"rejoin\",\"params\":{}}")["method"].textValue()))
        assertFalse(frame("{\"id\":1,\"method\":\"join\",\"params\":{}}")["params"].path("path").isTextual)
        val batch = frame("{\"id\":1,\"method\":\"applyActions\",\"params\":{\"path\":\"/a\",\"actions\":{}}}")
        assertFalse(batch["params"]["actions"].isArray)
        assertFalse(HubJson.isJsInteger(frame("{\"id\":1.5,\"method\":\"save\",\"params\":{\"path\":\"/a\"}}")["id"]))
        assertFalse(HubJson.isJsInteger(frame("{\"method\":\"save\",\"params\":{\"path\":\"/a\"}}")["id"]))
        assertFalse(HubJson.isRecord(frame("{\"id\":1,\"method\":\"listDocuments\",\"params\":[]}")["params"]))
        assertFalse(HubJson.isRecord(frame("{\"id\":1,\"method\":\"listDocuments\",\"params\":null}")["params"]))
        assertFalse(HubJson.isRecord(frame("{\"id\":1,\"method\":\"listDocuments\"}")["params"]))
        val notification = frame("{\"method\":\"actions\",\"params\":{\"path\":\"/a\",\"actions\":[]}}")
        assertFalse(HubJson.isJsInteger(notification["id"]))
        assertFalse(HubJson.isRecord(frame("[1,2]")))
        assertFalse(HubJson.isSafeInteger(frame("{\"id\":9007199254740992}")["id"]))
        assertTrue(HubJson.isJsInteger(frame("{\"id\":9007199254740992}")["id"]))
    }

    @Test
    fun `rebuilds every frame the connection scenarios expect`() {
        for (scenario in server.scenarios) {
            for (line in scenario.expect) {
                assertEquals("$scenario", line, rebuild(HubJson.parse(line)))
            }
        }
    }

    @Test
    fun `answers the connection side's refusals with the corpus texts`() {
        val expected = server.scenarios.flatMap { it.expect }.toSet()
        fun refusal(id: Double, method: String, code: HubErrorCode, message: String) =
            HubResults.errorResponse(id, method, code, message)

        val built = listOf(
            refusal(1.0, "hello", HubErrorCode.UNAUTHORIZED, HubTexts.UNAUTHORIZED),
            refusal(2.0, "rejoin", HubErrorCode.BAD_REQUEST, HubTexts.noMethod("rejoin")),
            refusal(3.0, "hello", HubErrorCode.BAD_REQUEST, HubTexts.noMethod("hello")),
            refusal(2.0, "toString", HubErrorCode.BAD_REQUEST, HubTexts.noMethod("toString")),
            refusal(2.0, "", HubErrorCode.BAD_REQUEST, HubTexts.noMethod("")),
            refusal(2.0, "join", HubErrorCode.BAD_REQUEST, HubTexts.needsPath("join")),
            refusal(2.0, "applyActions", HubErrorCode.BAD_REQUEST, HubTexts.needsPath("applyActions")),
            refusal(2.0, "applyActions", HubErrorCode.BAD_REQUEST, HubTexts.NEEDS_ACTIONS),
            refusal(2.0, "join", HubErrorCode.OUTSIDE_WORKSPACE, HubTexts.outsideWorkspace("/etc/passwd")),
            refusal(1e21, "rejoin", HubErrorCode.BAD_REQUEST, HubTexts.noMethod("rejoin")),
            HubResults.errorResponse(
                1.0, "hello", HubErrorCode.PROTOCOL_MISMATCH, HubTexts.protocolMismatch(1.0, 0.0), 1.0, 0.0,
            ),
            HubResults.errorResponse(
                1.0, "hello", HubErrorCode.PROTOCOL_MISMATCH, HubTexts.protocolMismatch(1.0, 1.5), 1.0, 1.5,
            ),
            HubResults.response(7.0, "hello", HubResults.hello(server.ide, server.version)),
            HubResults.response(9007199254740993.0, "listDocuments", HubResults.listDocuments(emptyList())),
            HubResults.response(-5.0, "listDocuments", HubResults.listDocuments(emptyList())),
        )
        for (frame in built) assertTrue(frame, frame in expected)
        assertEquals(server.authorizeRefuses["/etc/passwd"]!!.message, HubTexts.outsideWorkspace("/etc/passwd"))
        assertEquals(
            "/ws/a\u0000.erd has no real path the hub can check, such as a dangling link",
            HubTexts.noRealPath("/ws/a\u0000.erd"),
        )
    }

    private fun rebuild(frame: JsonNode): String {
        val id = frame["id"].asDouble()
        val method = frame["method"].textValue()
        if (frame["ok"].booleanValue()) return HubResults.response(id, method, rebuildResult(method, frame["result"]))
        val error = frame["error"]
        val code = HubErrorCode.entries.single { it.wire == error["code"].textValue() }
        return HubResults.errorResponse(
            id, method, code, error["message"].textValue(),
            error["hubProtocolVersion"]?.asDouble(), error["clientProtocolVersion"]?.asDouble(),
        )
    }

    // Field by field, so a key the builder drops, adds or orders differently changes the bytes.
    private fun rebuildResult(method: String, result: JsonNode): JsonNode = when (method) {
        "hello" -> HubResults.hello(result["ide"].textValue(), result["version"].textValue())
        "listDocuments" -> HubResults.listDocuments(
            result["documents"].map {
                HubResults.documentInfo(
                    it["path"].textValue(), it["open"].booleanValue(), it["active"].booleanValue(),
                    it["dirty"].booleanValue(), it["readonly"].booleanValue(),
                )
            },
        )
        "openDocument" -> HubResults.openDocument(
            result["path"].textValue(), result["opened"].booleanValue(), result["webviews"].intValue(),
        )
        "join" -> HubResults.join(
            result["initialValue"].textValue(), result["snapshotVersion"].asDouble(), result["readonly"].booleanValue(),
        )
        "applyActions" -> HubResults.applyActions(result["webviews"].intValue())
        "leave" -> HubResults.leave()
        "save" -> HubResults.save(result["saved"].booleanValue())
        else -> throw AssertionError("no result builder for $method")
    }
}
