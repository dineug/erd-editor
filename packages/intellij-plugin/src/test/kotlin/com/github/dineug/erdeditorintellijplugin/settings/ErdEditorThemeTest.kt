package com.github.dineug.erdeditorintellijplugin.settings

import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorTheme.Companion.ACCENT_COLORS
import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorTheme.Companion.APPEARANCES
import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorTheme.Companion.GRAY_COLORS
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files
import java.nio.file.Path

/**
 * The theme rules of the Obsidian plugin's settings.test.ts, and the value lists held to
 * packages/webview-bridge/src/theme.ts, which the page's theme builder picks from.
 */
class ErdEditorThemeTest {

    @Test
    fun `lists the values webview-bridge names, and auto`() {
        assertEquals(listOf("auto", "light", "dark"), APPEARANCES)
        assertEquals(bridgeValues("Appearance").toSet() + "auto", APPEARANCES.toSet())
        assertTrue(
            "webview-bridge no longer lets a theme's appearance be auto",
            Regex("""appearance: Appearance \| 'auto';""").containsMatchIn(bridgeTheme)
        )
        assertEquals(bridgeValues("GrayColor"), GRAY_COLORS)
        assertEquals(6, GRAY_COLORS.size)
        assertEquals(bridgeValues("AccentColor"), ACCENT_COLORS)
        assertEquals(26, ACCENT_COLORS.size)
    }

    @Test
    fun `follows the IDE in slate and indigo by default`() {
        assertEquals(ErdEditorTheme("auto", "slate", "indigo"), ErdEditorTheme.DEFAULT)
    }

    @Test
    fun `read falls back field by field to the theme it is given`() {
        val fallback = ErdEditorTheme("dark", "olive", "teal")

        assertEquals(fallback.copy(accentColor = "ruby"), ErdEditorTheme.read(null, null, "ruby", fallback))
        assertEquals(fallback, ErdEditorTheme.read(null, null, null, fallback))
        assertEquals(fallback, ErdEditorTheme.read("dim", "Olive", "plaid", fallback))
        assertEquals(fallback, ErdEditorTheme.read("", " slate", "indigo ", fallback))
        assertEquals(
            ErdEditorTheme("auto", "sand", "sky"),
            ErdEditorTheme.read("auto", "sand", "sky", fallback)
        )
        for (accentColor in ACCENT_COLORS) {
            assertEquals(accentColor, ErdEditorTheme.read(null, null, accentColor, fallback).accentColor)
        }
    }

    @Test
    fun `resolve turns auto into what the IDE shows`() {
        val theme = ErdEditorTheme("auto", "sage", "jade")

        assertEquals(ErdEditorTheme("dark", "sage", "jade"), theme.resolve(ideDark = true))
        assertEquals("light", theme.resolve(ideDark = false).appearance)
    }

    @Test
    fun `resolve keeps light and dark whatever the IDE shows`() {
        val theme = ErdEditorTheme("light", "sage", "jade")

        assertEquals(theme, theme.resolve(ideDark = true))
        assertEquals("dark", theme.copy(appearance = "dark").resolve(ideDark = false).appearance)
    }

    @Test
    fun `a builder pick keeps auto when it names the appearance auto shows now`() {
        val auto = ErdEditorTheme.DEFAULT

        assertEquals(
            ErdEditorTheme("auto", "slate", "crimson"),
            auto.fromBuilder("dark", "slate", "crimson", ideDark = true)
        )
        assertEquals(
            ErdEditorTheme("auto", "sand", "indigo"),
            auto.fromBuilder("light", "sand", "indigo", ideDark = false)
        )
    }

    @Test
    fun `a builder pick of the other appearance replaces auto`() {
        val auto = ErdEditorTheme.DEFAULT

        assertEquals(auto.copy(appearance = "light"), auto.fromBuilder("light", "slate", "indigo", ideDark = true))
        assertEquals(auto.copy(appearance = "dark"), auto.fromBuilder("dark", "slate", "indigo", ideDark = false))
    }

    @Test
    fun `a builder pick is taken whole once the setting names light or dark`() {
        val light = ErdEditorTheme.DEFAULT.copy(appearance = "light")

        assertEquals(
            ErdEditorTheme("dark", "mauve", "sky"),
            light.fromBuilder("dark", "mauve", "sky", ideDark = false)
        )
        assertEquals(light.copy(accentColor = "sky"), light.fromBuilder("light", "slate", "sky", ideDark = true))
    }

    @Test
    fun `a builder pick keeps the current value for anything it lacks or holds wrong`() {
        val auto = ErdEditorTheme.DEFAULT

        assertEquals(auto, auto.fromBuilder(null, null, null, ideDark = true))
        assertEquals(auto, auto.fromBuilder("dim", null, "plaid", ideDark = false))
    }

    private companion object {
        // The file erd.bridgeTheme names, else the one beside packages/intellij-plugin, where Gradle
        // runs the tests.
        val bridgeTheme: String by lazy {
            Files.readString(Path.of(System.getProperty("erd.bridgeTheme") ?: "../webview-bridge/src/theme.ts"))
        }

        /** The values of the object webview-bridge exports as [name], in source order. */
        fun bridgeValues(name: String): List<String> {
            val body = Regex("""export const $name = \{(.*?)\} as const;""", RegexOption.DOT_MATCHES_ALL)
                .find(bridgeTheme)?.groupValues?.get(1)
                ?: throw AssertionError("theme.ts no longer declares $name as an object literal")
            val entries = Regex("""(\w+): '([^']*)',""").findAll(body).map { it.groupValues }.toList()
            for ((_, key, value) in entries) assertEquals("$name.$key", key, value)
            // Every line of the literal is one entry, so an entry spelled another way fails here.
            assertEquals(body.lines().count { it.isNotBlank() }, entries.size)
            return entries.map { it[2] }
        }
    }
}
