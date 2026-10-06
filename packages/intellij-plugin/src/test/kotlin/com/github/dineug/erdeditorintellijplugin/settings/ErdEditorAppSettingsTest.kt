package com.github.dineug.erdeditorintellijplugin.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.util.xmlb.XmlSerializer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The stored theme and display language: their defaults, what a stored value that is missing or
 * unknown reads as, what the pages are shown, and when a change reaches the open editors, all with
 * no Application.
 */
class ErdEditorAppSettingsTest {
    private var ideDark = true
    private var ideLanguage = "ko"
    private var published = 0
    private val settings = ErdEditorAppSettings({ ideDark }, { ideLanguage }) { published++ }

    @Test
    fun `the theme follows the IDE in slate and indigo by default`() {
        assertEquals(ErdEditorTheme("auto", "slate", "indigo"), settings.theme)
        assertEquals(settings.theme, theme(settings.state))
        assertEquals(settings.theme, theme(ErdEditorAppSettings.State()))
    }

    @Test
    fun `loadState keeps the stored values and copies them`() {
        val stored = ErdEditorAppSettings.State("light", "mauve", "crimson")

        settings.loadState(stored)
        stored.appearance = "dark"

        assertEquals(ErdEditorTheme("light", "mauve", "crimson"), settings.theme)
        assertEquals(settings.theme, theme(settings.state))
        assertEquals(0, published)
    }

    @Test
    fun `loadState takes the default for each stored value that is unknown`() {
        settings.loadState(ErdEditorAppSettings.State("dim", "plaid", "sky"))

        assertEquals(ErdEditorTheme("auto", "slate", "sky"), settings.theme)
    }

    @Test
    fun `a file that names no appearance reads as auto`() {
        // The old default, dark, was never written, so a file saved with it names no appearance.
        val written = XmlSerializer.serialize(ErdEditorAppSettings.State("dark", "mauve", "indigo"))
        written.children.single { it.getAttributeValue("name") == "appearance" }.detach()

        settings.loadState(XmlSerializer.deserialize(written, ErdEditorAppSettings.State::class.java))

        assertEquals(ErdEditorTheme("auto", "mauve", "indigo"), settings.theme)
    }

    @Test
    fun `a picked theme is written and read back`() {
        fun roundTrip(state: ErdEditorAppSettings.State) = theme(
            XmlSerializer.deserialize(XmlSerializer.serialize(state), ErdEditorAppSettings.State::class.java)
        )

        assertEquals(ErdEditorTheme("dark", "sand", "ruby"), roundTrip(ErdEditorAppSettings.State("dark", "sand", "ruby")))
        assertEquals(ErdEditorTheme.DEFAULT, roundTrip(ErdEditorAppSettings.State()))
    }

    @Test
    fun `a change reaches the open editors once`() {
        val light = ErdEditorTheme.DEFAULT.copy(appearance = "light")

        settings.updateTheme { ErdEditorTheme.DEFAULT }
        settings.updateTheme { light }
        settings.updateTheme { light }
        settings.updateTheme { it.copy(grayColor = "sage") }

        assertEquals(2, published)
        assertEquals(ErdEditorTheme("light", "sage", "indigo"), settings.theme)
    }

    @Test
    fun `storing the current theme or display language never reaches the message bus`() {
        // No Application exists in a plain JUnit run, so a publish would throw here.
        assertNull(ApplicationManager.getApplication())
        val settings = ErdEditorAppSettings()

        settings.updateTheme { ErdEditorTheme.DEFAULT }
        settings.updateLocale("auto")
        settings.updateLocale("system")

        assertEquals(ErdEditorTheme.DEFAULT, settings.theme)
        assertEquals("auto", settings.locale)
    }

    @Test
    fun `with no IDE running the language auto follows is the platform's default, English`() {
        // The platform answers its default with no Application, as it does for a language with no
        // language pack, so this shows only the fallback; that auto follows the language an IDE
        // shows is checked by hand in an IDE switched to another language.
        assertEquals("en", ErdEditorAppSettings().systemLocale)
    }

    @Test
    fun `the display language follows the IDE by default`() {
        assertEquals("auto", settings.locale)
        assertEquals("auto", settings.state.locale)
        assertEquals("auto", ErdEditorAppSettings.State().locale)
    }

    @Test
    fun `loadState keeps a stored display language and reads one it cannot hold as auto`() {
        settings.loadState(ErdEditorAppSettings.State(locale = "ja-JP"))
        assertEquals("ja-JP", settings.locale)
        assertEquals("ja-JP", settings.state.locale)

        for (stored in listOf("system", "ko", "KO-KR", "")) {
            settings.loadState(ErdEditorAppSettings.State(locale = stored))
            assertEquals(stored, "auto", settings.locale)
        }
        assertEquals(0, published)
    }

    @Test
    fun `a file that names no display language reads as auto and keeps its theme`() {
        // A file an older release wrote names no locale.
        val written = XmlSerializer.serialize(ErdEditorAppSettings.State("light", "mauve", "indigo", "ja-JP"))
        written.children.single { it.getAttributeValue("name") == "locale" }.detach()

        settings.loadState(XmlSerializer.deserialize(written, ErdEditorAppSettings.State::class.java))

        assertEquals("auto", settings.locale)
        assertEquals(ErdEditorTheme("light", "mauve", "indigo"), settings.theme)
    }

    @Test
    fun `a picked display language is written and read back`() {
        val state = ErdEditorAppSettings.State(locale = "zh-TW")

        val read = XmlSerializer.deserialize(XmlSerializer.serialize(state), ErdEditorAppSettings.State::class.java)

        assertEquals("zh-TW", read.locale)
    }

    @Test
    fun `a display language change reaches the open editors once`() {
        settings.updateLocale("auto")
        settings.updateLocale("de-DE")
        settings.updateLocale("de-DE")
        settings.updateLocale("auto")

        assertEquals(2, published)
        assertEquals("auto", settings.locale)
    }

    @Test
    fun `a display language the setting cannot hold keeps the stored one`() {
        settings.updateLocale("fa-IR")

        for (value in listOf("system", "ko", "KO-KR", "")) settings.updateLocale(value)

        assertEquals("fa-IR", settings.locale)
        assertEquals(1, published)
    }

    @Test
    fun `auto follows the language the IDE shows now, whatever the setting`() {
        assertEquals("ko", settings.systemLocale)
        ideLanguage = "zh-CN"
        assertEquals("zh-CN", settings.systemLocale)

        settings.updateLocale("en")
        assertEquals("zh-CN", settings.systemLocale)
        assertEquals("en", settings.locale)
    }

    @Test
    fun `a theme change keeps the display language and a display language change keeps the theme`() {
        settings.updateLocale("he-IL")
        settings.updateTheme { it.copy(appearance = "dark") }

        assertEquals("he-IL", settings.locale)
        assertEquals(ErdEditorTheme("dark", "slate", "indigo"), settings.theme)
        val state = settings.state
        assertEquals("he-IL", state.locale)
        assertEquals("dark", state.appearance)
    }

    @Test
    fun `auto shows the light or dark the IDE shows now, whatever the setting`() {
        assertEquals("dark", settings.systemAppearance)
        ideDark = false
        assertEquals("light", settings.systemAppearance)

        settings.updateTheme { it.copy(appearance = "dark") }
        assertEquals("light", settings.systemAppearance)
        assertEquals("dark", settings.theme.appearance)
    }

    @Test
    fun `a builder pick of auto keeps auto and re-themes nothing`() {
        settings.setThemeFromBuilder("auto", "slate", "indigo")

        assertEquals(ErdEditorTheme.DEFAULT, settings.theme)
        assertEquals(0, published)

        settings.setThemeFromBuilder("auto", "slate", "crimson")

        assertEquals(ErdEditorTheme("auto", "slate", "crimson"), settings.theme)
        assertEquals(1, published)
    }

    @Test
    fun `a builder pick of light or dark replaces auto, even the one auto shows now`() {
        ideDark = false
        settings.setThemeFromBuilder("light", "sand", null)
        assertEquals(ErdEditorTheme("light", "sand", "indigo"), settings.theme)

        settings.setThemeFromBuilder("auto", null, null)
        assertEquals(ErdEditorTheme("auto", "sand", "indigo"), settings.theme)

        settings.setThemeFromBuilder("dark", null, null)
        assertEquals(ErdEditorTheme("dark", "sand", "indigo"), settings.theme)
        assertEquals(3, published)
    }

    @Test
    fun `a builder pick keeps the stored value for anything it lacks or holds wrong`() {
        settings.setThemeFromBuilder(null, null, null)
        settings.setThemeFromBuilder("dim", null, "plaid")

        assertEquals(ErdEditorTheme.DEFAULT, settings.theme)
        assertEquals(0, published)
    }

    @Test
    fun `an update another write overtook is made again from the theme that write stored`() {
        var tries = 0

        settings.updateTheme { stored ->
            // A theme builder's pick lands between this update's read and its write.
            if (tries++ == 0) settings.setThemeFromBuilder("light", "sand", null)
            ErdEditorConfigurable.changed(stored, null, null, "crimson")
        }

        assertEquals(2, tries)
        assertEquals(ErdEditorTheme("light", "sand", "crimson"), settings.theme)
        assertEquals(2, published)
    }

    private fun theme(state: ErdEditorAppSettings.State) =
        ErdEditorTheme(state.appearance, state.grayColor, state.accentColor)
}
