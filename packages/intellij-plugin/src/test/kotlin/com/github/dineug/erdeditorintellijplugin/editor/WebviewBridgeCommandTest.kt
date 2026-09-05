package com.github.dineug.erdeditorintellijplugin.editor

import com.fasterxml.jackson.databind.JsonNode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins the wire format of the bridge. The `type` strings are a contract shared with
 * `erd-editor/packages/webview-bridge`; changing one side alone makes commands silently ignored.
 */
class WebviewBridgeCommandTest {

    private val mapper = WebviewScripts.mapper

    private fun typeOf(command: WebviewBridgeCommand): String =
        mapper.readTree(mapper.writeValueAsString(command)).get("type").asText()

    @Test
    fun `host commands deserialize by their type discriminator`() {
        val initial = mapper.readValue(
            """{"type":"hostInitialCommand"}""",
            HostBridgeCommand::class.java
        )
        assertTrue(initial is HostBridgeCommand.Initial)

        val save = mapper.readValue(
            """{"type":"hostSaveValueCommand","payload":{"value":"{}"}}""",
            HostBridgeCommand::class.java
        )
        assertTrue(save is HostBridgeCommand.SaveValue)
        assertEquals("{}", (save as HostBridgeCommand.SaveValue).payload.value)

        val export = mapper.readValue(
            """{"type":"hostExportFileCommand","payload":{"value":"AA==","fileName":"a.png"}}""",
            HostBridgeCommand::class.java
        )
        assertTrue(export is HostBridgeCommand.ExportFile)
        assertEquals("a.png", (export as HostBridgeCommand.ExportFile).payload.fileName)
    }

    @Test
    fun `unknown fields are tolerated but unknown commands are rejected`() {
        // The web app may add fields ahead of the host; that must not break parsing.
        val withExtra = mapper.readValue(
            """{"type":"hostInitialCommand","somethingNew":true}""",
            HostBridgeCommand::class.java
        )
        assertTrue(withExtra is HostBridgeCommand.Initial)

        // An unknown command must fail loudly here so that WebviewPanel.onQuery can log and drop it
        // rather than throwing across the native CEF boundary.
        val failed = runCatching {
            mapper.readValue("""{"type":"totallyUnknownCommand"}""", HostBridgeCommand::class.java)
        }
        assertTrue("unknown type ids must not parse", failed.isFailure)
    }

    @Test
    fun `webview commands carry their type on the wire`() {
        assertEquals(
            "webviewInitialValueCommand",
            typeOf(WebviewBridgeCommand.InitialValue(WebviewInitialValueCommandPayload("{}")))
        )
        assertEquals(
            "webviewUpdateThemeCommand",
            typeOf(WebviewBridgeCommand.UpdateTheme(WebviewUpdateThemeCommandPayload("dark", "slate", "indigo")))
        )
        assertEquals(
            "webviewUpdateReadonlyCommand",
            typeOf(WebviewBridgeCommand.UpdateReadonly(true))
        )
        assertEquals(
            "webviewReplicationCommand",
            typeOf(WebviewBridgeCommand.Replication(WebviewReplicationCommandPayload(listOf<Any>())))
        )
        assertEquals(
            "webviewImportFileCommand",
            typeOf(WebviewBridgeCommand.ImportFile(WebviewImportFileCommandPayload("json", "import", "{}")))
        )
    }

    @Test
    fun `import file payload carries the file type through untouched`() {
        // `type` is a plain String here, so the host never validates it; the webview switch is the
        // only thing that reads it. Whatever the bridge union grows must survive this round trip
        // verbatim, casing included.
        val json = mapper.readTree(
            mapper.writeValueAsString(
                WebviewBridgeCommand.ImportFile(
                    WebviewImportFileCommandPayload("graphql", "set", "type User { id: ID! }")
                )
            )
        )

        val payload = json.get("payload")
        assertEquals("graphql", payload.get("type").asText())
        assertEquals("set", payload.get("op").asText())
        assertEquals("type User { id: ID! }", payload.get("value").asText())
    }

    @Test
    fun `null theme fields are omitted rather than serialized as null`() {
        val json: JsonNode = mapper.readTree(
            mapper.writeValueAsString(
                WebviewBridgeCommand.UpdateTheme(WebviewUpdateThemeCommandPayload(null, null, "indigo"))
            )
        )

        val payload = json.get("payload")
        assertTrue(payload.has("accentColor"))
        assertTrue("NON_NULL inclusion must drop absent fields", !payload.has("appearance"))
        assertTrue(!payload.has("grayColor"))
    }
}
