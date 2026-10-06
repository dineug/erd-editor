package com.github.dineug.erdeditorintellijplugin.settings

import org.junit.Assert.assertEquals
import org.junit.Test
import org.w3c.dom.Element
import javax.xml.parsers.DocumentBuilderFactory

/**
 * The settings page's registration, its option names and what its apply stores; drawing it needs an
 * IDE, as textListCellRenderer reads an Application service.
 */
class ErdEditorConfigurableTest {

    @Test
    fun `plugin xml registers the page under Tools as ERD Editor`() {
        val document = javaClass.getResourceAsStream("/META-INF/plugin.xml")!!.use {
            DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(it)
        }
        val nodes = document.getElementsByTagName("applicationConfigurable")
        val pages = (0 until nodes.length).map { nodes.item(it) as Element }
        val page = pages.single()

        assertEquals(ErdEditorConfigurable::class.java.name, page.getAttribute("instance"))
        assertEquals(ErdEditorConfigurable::class.java.name, page.getAttribute("id"))
        assertEquals("tools", page.getAttribute("parentId"))
        assertEquals("ERD Editor", page.getAttribute("displayName"))
        assertEquals("ERD Editor", ErdEditorConfigurable().displayName)
    }

    @Test
    fun `names each option with a capital`() {
        assertEquals(
            listOf("Auto", "Light", "Dark"),
            ErdEditorTheme.APPEARANCES.map(ErdEditorConfigurable::optionName)
        )
        assertEquals("Slate", ErdEditorConfigurable.optionName("slate"))
        assertEquals("Indigo", ErdEditorConfigurable.optionName("indigo"))
    }

    @Test
    fun `apply keeps the stored value of each field the page left alone`() {
        val stored = ErdEditorTheme("light", "sand", "ruby")

        assertEquals(stored, ErdEditorConfigurable.changed(stored, null, null, null))
        assertEquals(
            ErdEditorTheme("light", "sand", "crimson"),
            ErdEditorConfigurable.changed(stored, null, null, "crimson")
        )
        assertEquals(
            ErdEditorTheme("auto", "slate", "ruby"),
            ErdEditorConfigurable.changed(stored, "auto", "slate", null)
        )
        assertEquals(
            ErdEditorTheme("dark", "olive", "teal"),
            ErdEditorConfigurable.changed(stored, "dark", "olive", "teal")
        )
    }

    @Test
    fun `apply stores only what the page changed, the theme as one change and the language after it`() {
        val published = mutableListOf<Pair<ErdEditorTheme, String>>()
        val settings = ErdEditorAppSettings({ false }, { "en" }) { published += it.theme to it.locale }

        ErdEditorConfigurable.store(settings, null, null, null, null)
        assertEquals(emptyList<Pair<ErdEditorTheme, String>>(), published)

        ErdEditorConfigurable.store(settings, null, null, null, "uk-UA")
        assertEquals(listOf(ErdEditorTheme.DEFAULT to "uk-UA"), published)

        published.clear()
        ErdEditorConfigurable.store(settings, "dark", null, "teal", "auto")
        assertEquals(
            listOf(
                ErdEditorTheme("dark", "slate", "teal") to "uk-UA",
                ErdEditorTheme("dark", "slate", "teal") to "auto"
            ),
            published
        )
    }
}
