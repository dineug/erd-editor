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
}
