package com.github.dineug.erdeditorintellijplugin.editor

import com.fasterxml.jackson.databind.JsonNode
import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorAppSettings
import com.intellij.openapi.diagnostic.Logger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Collections
import java.util.concurrent.atomic.AtomicInteger

/**
 * Pins the wire format of the bridge. The `type` strings are a contract shared with
 * `erd-editor/packages/webview-bridge`; changing one side alone makes commands silently ignored.
 */
class WebviewBridgeCommandTest {

    private val mapper = WebviewScripts.mapper

    private fun typeOf(command: WebviewBridgeCommand): String =
        mapper.readTree(mapper.writeValueAsString(command)).get("type").asText()

    private fun saveValue(value: String) =
        """{"type":"hostSaveValueCommand","payload":{"value":"$value"}}"""

    /** Subscribes [bridge] and returns the values of the save commands it handles, in order. */
    private fun CoroutineScope.handledValues(
        bridge: WebviewBridge,
        block: suspend (String) -> Unit = {},
    ): Channel<String> {
        val handled = Channel<String>(Channel.UNLIMITED)
        bridge.subscribe(this) { command ->
            val value = (command as HostBridgeCommand.SaveValue).payload.value
            block(value)
            handled.send(value)
        }
        return handled
    }

    private suspend fun Channel<String>.take(count: Int): List<String> =
        withTimeout(10_000) { List(count) { receive() } }

    /**
     * Runs [test] while every bridge created in it logs its warnings into the list it is given, and
     * puts the previous logger factory back afterwards; other categories still log as before.
     */
    private fun <T> recordingBridgeWarnings(test: (warnings: List<String>) -> T): T {
        val warnings = Collections.synchronizedList(mutableListOf<String>())
        val previous = Logger.getFactory()
        Logger.setFactory { category ->
            if (category != "#${WebviewBridge::class.java.name}") {
                previous.getLoggerInstance(category)
            } else {
                object : Logger() {
                    override fun isDebugEnabled() = false
                    override fun debug(message: String?, t: Throwable?) = Unit
                    override fun info(message: String?, t: Throwable?) = Unit
                    override fun warn(message: String?, t: Throwable?) {
                        warnings.add(message.orEmpty())
                    }
                    override fun error(message: String?, t: Throwable?, vararg details: String?) = Unit
                }
            }
        }
        try {
            return test(warnings)
        } finally {
            Logger.setFactory(previous)
        }
    }

    private fun withBridgeScope(test: suspend CoroutineScope.() -> Unit) = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            scope.test()
        } finally {
            scope.cancel()
        }
    }

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
        // A page from before the flag sent none, and every save it sent was a change.
        assertTrue(save.payload.changed)

        val unchanged = mapper.readValue(
            """{"type":"hostSaveValueCommand","payload":{"value":"{}","changed":false}}""",
            HostBridgeCommand::class.java
        ) as HostBridgeCommand.SaveValue
        assertFalse(unchanged.payload.changed)

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

        // An unknown command must fail loudly here so that the bridge's consumer can log and drop
        // it rather than hand the editor something it cannot act on.
        val failed = runCatching {
            mapper.readValue("""{"type":"totallyUnknownCommand"}""", HostBridgeCommand::class.java)
        }
        assertTrue("unknown type ids must not parse", failed.isFailure)
    }

    @Test
    fun `offered requests are handled one at a time in the order they arrived`() = withBridgeScope {
        val bridge = WebviewBridge { "schema.erd" }
        // Half before the consumer starts: a channel keeps them, where a shared flow dropped them.
        repeat(500) { assertTrue(bridge.offer(saveValue("$it"))) }

        val running = AtomicInteger()
        val overlaps = AtomicInteger()
        val handled = handledValues(bridge) {
            if (running.incrementAndGet() > 1) overlaps.incrementAndGet()
            yield()
            running.decrementAndGet()
        }
        repeat(500) { assertTrue(bridge.offer(saveValue("${500 + it}"))) }

        assertEquals(List(1000) { "$it" }, handled.take(1000))
        assertEquals("the handler never runs twice at once", 0, overlaps.get())
    }

    @Test
    fun `a request that does not parse is logged, skipped and the next one still runs`() =
        recordingBridgeWarnings { warnings ->
            withBridgeScope {
                // The file is renamed while its tab is open: the warning names it as it is called now.
                var name = "draft.erd"
                val bridge = WebviewBridge { name }
                val handled = handledValues(bridge)
                name = "schema.erd"

                bridge.offer(saveValue("before"))
                bridge.offer("""{"type":"totallyUnknownCommand"}""")
                bridge.offer("not json")
                bridge.offer(saveValue("after"))

                assertEquals(listOf("before", "after"), handled.take(2))
            }
            // The consumer logs a request before it takes the next, so both are in by now.
            assertEquals(
                listOf(
                    """schema.erd: unparseable bridge command: {"type":"totallyUnknownCommand"}""",
                    "schema.erd: unparseable bridge command: not json",
                ),
                warnings.toList()
            )
        }

    @Test
    fun `a handler that throws does not stop the bridge`() = withBridgeScope {
        val bridge = WebviewBridge { "schema.erd" }
        val handled = handledValues(bridge) { value ->
            if (value == "boom") throw IllegalStateException("handler failed")
        }

        bridge.offer(saveValue("boom"))
        bridge.offer(saveValue("next"))

        assertEquals(listOf("next"), handled.take(1))
    }

    @Test
    fun `a closed bridge refuses new requests but handles the ones it took`() = withBridgeScope {
        val bridge = WebviewBridge { "schema.erd" }
        assertTrue(bridge.offer(saveValue("taken")))
        bridge.close()
        assertFalse(bridge.offer(saveValue("late")))

        assertEquals(listOf("taken"), handledValues(bridge).take(1))
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
            typeOf(WebviewBridgeCommand.Replication(WebviewReplicationCommandPayload(mapper.createArrayNode())))
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
    fun `null fields inside relayed actions survive the round trip`() {
        // A coding agent's presence clears its focus with a null; dropping the key corrupts it.
        val actions = """[{"type":"sharedFocusTracker","payload":{"focus":null,"at":1.5},""" +
            """"version":3},{"type":"x","payload":{"list":[null,1,null],"big":1e21}}]"""
        val received = mapper.readValue(
            """{"type":"hostSaveReplicationCommand","payload":{"actions":$actions}}""",
            HostBridgeCommand::class.java
        ) as HostBridgeCommand.SaveReplication

        val relayed = mapper.readTree(
            mapper.writeValueAsString(
                WebviewBridgeCommand.Replication(WebviewReplicationCommandPayload(received.payload.actions))
            )
        )

        assertEquals(mapper.readTree(actions), relayed.get("payload").get("actions"))
        val focus = relayed.get("payload").get("actions").get(0).get("payload")
        assertTrue("the null focus must be sent, not dropped", focus.has("focus"))
        assertTrue(focus.get("focus").isNull)
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
        assertTrue(!payload.has("systemAppearance"))
    }

    @Test
    fun `a page is sent the stored theme with the light or dark the IDE shows now`() {
        var ideDark = false
        val settings = ErdEditorAppSettings({ ideDark }) {}

        assertEquals(
            WebviewUpdateThemeCommandPayload("auto", "slate", "indigo", "light"),
            WebviewBridgeCommand.UpdateTheme.of(settings).payload
        )

        settings.updateTheme { it.copy(appearance = "dark") }
        ideDark = true
        assertEquals(
            WebviewUpdateThemeCommandPayload("dark", "slate", "indigo", "dark"),
            WebviewBridgeCommand.UpdateTheme.of(settings).payload
        )
    }

    @Test
    fun `a theme update carries auto with the light or dark it shows`() {
        val payload = mapper.readTree(
            mapper.writeValueAsString(
                WebviewBridgeCommand.UpdateTheme(
                    WebviewUpdateThemeCommandPayload("auto", "slate", "indigo", "light")
                )
            )
        ).get("payload")

        assertEquals("auto", payload.get("appearance").asText())
        assertEquals("light", payload.get("systemAppearance").asText())
    }
}
