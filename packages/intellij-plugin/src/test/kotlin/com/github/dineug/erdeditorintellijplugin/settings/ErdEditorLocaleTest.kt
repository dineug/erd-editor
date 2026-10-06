package com.github.dineug.erdeditorintellijplugin.settings

import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorLocale.NAMES
import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorLocale.SETTINGS
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files
import java.nio.file.Path

/**
 * The display language rules the settings page, the stored state and a page's pick share, and the
 * language list held to packages/webview-bridge/src/locale.ts, which the page's picker lists.
 */
class ErdEditorLocaleTest {

    @Test
    fun `lists the languages webview-bridge names, in its order, each by its own name`() {
        assertEquals(bridgeLabels(), NAMES.toList())
        assertEquals(25, NAMES.size)
        assertEquals("en" to "English", NAMES.entries.first().toPair())
        assertEquals("ko-KR" to "한국어", NAMES.entries.last().toPair())
    }

    @Test
    fun `the setting holds auto, then every language, as webview-bridge's LocaleSetting does`() {
        assertTrue(
            "webview-bridge no longer lets a host's locale setting be auto",
            Regex("""export type LocaleSetting = Locale \| 'auto';""").containsMatchIn(bridgeLocale)
        )
        assertEquals(listOf("auto") + bridgeLabels().map { it.first }, SETTINGS)
    }

    @Test
    fun `follows the IDE's language by default`() {
        assertEquals("auto", ErdEditorLocale.AUTO)
        assertEquals(ErdEditorLocale.AUTO, ErdEditorLocale.DEFAULT)
    }

    @Test
    fun `read keeps a value the setting holds and takes the fallback for anything else`() {
        for (value in SETTINGS) assertEquals(value, ErdEditorLocale.read(value, "ja-JP"))

        assertEquals("ja-JP", ErdEditorLocale.read(null, "ja-JP"))
        // The editor's own spelling of auto, a bare language and another letter case are not codes.
        assertEquals("ja-JP", ErdEditorLocale.read("system", "ja-JP"))
        assertEquals("ja-JP", ErdEditorLocale.read("ko", "ja-JP"))
        assertEquals("ja-JP", ErdEditorLocale.read("KO-KR", "ja-JP"))
        assertEquals("auto", ErdEditorLocale.read("", "auto"))
        assertEquals("auto", ErdEditorLocale.read(" en", "auto"))
    }

    @Test
    fun `names auto Auto and each language by its own name`() {
        assertEquals(
            listOf("Auto") + bridgeLabels().map { it.second },
            SETTINGS.map(ErdEditorLocale::optionName)
        )
        assertEquals("Português Brasileiro", ErdEditorLocale.optionName("pt-BR"))
        assertEquals("العربية", ErdEditorLocale.optionName("ar-SA"))
        // Nothing lists another value; one would show as it is spelled.
        assertEquals("xx-XX", ErdEditorLocale.optionName("xx-XX"))
    }

    private companion object {
        // The file erd.bridgeLocale names, else the one beside packages/intellij-plugin, where Gradle
        // runs the tests. Files.readString always decodes UTF-8, the native names included.
        val bridgeLocale: String by lazy {
            Files.readString(Path.of(System.getProperty("erd.bridgeLocale") ?: "../webview-bridge/src/locale.ts"))
        }

        /**
         * The entries of LocaleLabel, code to name, in source order. A code is a bare key (en) or a
         * quoted one ('id-ID'), as the formatter writes them.
         */
        fun bridgeLabels(): List<Pair<String, String>> {
            val body = Regex("""export const LocaleLabel = \{(.*?)\} as const;""", RegexOption.DOT_MATCHES_ALL)
                .find(bridgeLocale)?.groupValues?.get(1)
                ?: throw AssertionError("locale.ts no longer declares LocaleLabel as an object literal")
            val entries = Regex("""(?:([A-Za-z]+)|'([A-Za-z-]+)'): '([^']*)',""").findAll(body)
                .map { (it.groupValues[1].ifEmpty { it.groupValues[2] }) to it.groupValues[3] }
                .toList()
            // Every line of the literal is one entry, so an entry spelled another way fails here.
            assertEquals(body.lines().count { it.isNotBlank() }, entries.size)
            return entries
        }
    }
}
