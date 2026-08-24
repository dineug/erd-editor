package com.github.dineug.erdeditorintellijplugin.editor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression tests for the webview bridge payload encoding.
 *
 * The payload used to be spliced into a `String.raw` template literal. That made a single backtick in
 * any table name abort the whole script - the editor then stayed blank forever - and made `${...}`
 * execute as JavaScript. Both are reachable with ordinary ERD content (MySQL backtick-quoted
 * identifiers in comments, markdown code spans in memos), so keep these tests if the encoding is
 * ever touched again.
 */
class WebviewScriptsTest {

    private fun literalOf(script: String): String =
        script.removePrefix("window.postMessage(JSON.parse(")
            .removeSuffix(", 'https://${WebviewScripts.DOMAIN}')")

    @Test
    fun `payload is embedded as a quoted JS string literal, not a template literal`() {
        val script = WebviewScripts.postMessageScript("""{"value":"plain"}""")

        assertTrue(script.startsWith("window.postMessage(JSON.parse(\""))
        assertTrue(script.endsWith(", 'https://${WebviewScripts.DOMAIN}')"))
        assertFalse("must not use a template literal", script.contains("String.raw"))
    }

    @Test
    fun `backtick in the payload is data, not syntax`() {
        val payload = """{"value":"SELECT `id` FROM t"}"""
        val script = WebviewScripts.postMessageScript(payload)

        // The backtick survives verbatim - JSON has no reason to escape it - and that is fine
        // precisely because it now sits inside a double-quoted literal instead of a template one.
        assertFalse("a template literal would let the backtick close it", script.contains("String.raw"))
        assertEquals(payload, WebviewScripts.mapper.readValue(literalOf(script), String::class.java))
    }

    @Test
    fun `dollar brace in the payload is not evaluated`() {
        val payload = """{"value":"cost ${'$'}{globalThis.PWNED = 1} usd"}"""
        val script = WebviewScripts.postMessageScript(payload)

        // Inside a double-quoted JS string literal `${` carries no meaning, so it only has to survive
        // as data - what matters is that it is not sitting inside a template literal.
        assertFalse(script.contains("String.raw"))
        assertTrue(script.startsWith("window.postMessage(JSON.parse(\""))
    }

    @Test
    fun `round trip preserves the exact payload`() {
        val payloads = listOf(
            """{"value":"SELECT `id` FROM t"}""",
            """{"value":"cost ${'$'}{x} usd"}""",
            """{"value":"backslash \\ quote \" newline \n tab \t"}""",
            """{"value":"유니코드 한글과 이모지 🐘"}""",
            "{\"value\":\"line\u2028separator\u2029here\"}",
        )

        for (payload in payloads) {
            val literal = literalOf(WebviewScripts.postMessageScript(payload))
            // The literal is valid JSON text describing the original string.
            val decoded = WebviewScripts.mapper.readValue(literal, String::class.java)
            assertEquals(payload, decoded)
        }
    }

    @Test
    fun `line and paragraph separators are escaped`() {
        val script = WebviewScripts.postMessageScript("a\u2028b\u2029c")

        assertFalse("U+2028 is illegal in a JS string literal", script.contains('\u2028'))
        assertFalse("U+2029 is illegal in a JS string literal", script.contains('\u2029'))
        assertTrue(script.contains("\\u2028"))
        assertTrue(script.contains("\\u2029"))
    }

    @Test
    fun `target origin is the plugin domain`() {
        val script = WebviewScripts.postMessageScript("{}")

        assertTrue(script.endsWith(", 'https://erd-editor-jetbrains-plugin')"))
        assertEquals("https://erd-editor-jetbrains-plugin/index.html", WebviewScripts.PLUGIN_URL)
    }
}
