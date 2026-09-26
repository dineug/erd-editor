package com.github.dineug.erdeditorintellijplugin.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.util.xmlb.XmlSerializer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The stored theme: its default, what a stored value that is missing or unknown reads as, what the
 * pages are shown, and when a change reaches the open editors, all with no Application.
 */
class ErdEditorAppSettingsTest {
    private var ideDark = true
    private var published = 0
    private val settings = ErdEditorAppSettings({ ideDark }) { published++ }

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
    fun `storing the current theme never reaches the message bus`() {
        // No Application exists in a plain JUnit run, so a publish would throw here.
        assertNull(ApplicationManager.getApplication())
        val settings = ErdEditorAppSettings()

        settings.updateTheme { ErdEditorTheme.DEFAULT }

        assertEquals(ErdEditorTheme.DEFAULT, settings.theme)
    }

    @Test
    fun `the pages are shown auto as the light or dark the IDE shows now`() {
        assertEquals(ErdEditorTheme("dark", "slate", "indigo"), settings.shownTheme)
        ideDark = false
        assertEquals(ErdEditorTheme("light", "slate", "indigo"), settings.shownTheme)

        settings.updateTheme { it.copy(appearance = "dark") }
        assertEquals(ErdEditorTheme("dark", "slate", "indigo"), settings.shownTheme)
    }

    @Test
    fun `a builder pick of the appearance auto shows keeps auto and re-themes nothing`() {
        settings.setThemeFromBuilder("dark", "slate", "indigo")

        assertEquals(ErdEditorTheme.DEFAULT, settings.theme)
        assertEquals(0, published)

        settings.setThemeFromBuilder("dark", "slate", "crimson")

        assertEquals(ErdEditorTheme("auto", "slate", "crimson"), settings.theme)
        assertEquals(1, published)
    }

    @Test
    fun `a builder pick of the other appearance replaces auto by what the IDE shows now`() {
        ideDark = false
        settings.setThemeFromBuilder("light", "sand", null)
        assertEquals(ErdEditorTheme("auto", "sand", "indigo"), settings.theme)

        settings.setThemeFromBuilder("dark", null, null)

        assertEquals(ErdEditorTheme("dark", "sand", "indigo"), settings.theme)
        assertEquals(2, published)
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
