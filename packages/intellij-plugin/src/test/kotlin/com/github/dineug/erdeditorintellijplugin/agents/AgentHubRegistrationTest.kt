package com.github.dineug.erdeditorintellijplugin.agents

import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.startup.ProjectActivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element
import javax.xml.parsers.DocumentBuilderFactory

/**
 * plugin.xml names each listener by string, so a renamed class or a wrong topic would only show in a
 * running IDE, as a hub that never hears of a project closing or of the IDE quitting.
 */
class AgentHubRegistrationTest {
    private val pluginXml = javaClass.getResourceAsStream("/META-INF/plugin.xml")!!.use {
        DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(it)
    }

    private fun elements(parent: String, tag: String): List<Element> {
        val parents = pluginXml.getElementsByTagName(parent)
        return (0 until parents.length).flatMap { index ->
            val children = (parents.item(index) as Element).getElementsByTagName(tag)
            (0 until children.length).map { children.item(it) as Element }
        }
    }

    private fun listeners(parent: String): Map<String, String> =
        elements(parent, "listener").associate { it.getAttribute("class") to it.getAttribute("topic") }

    private fun load(name: String): Class<*> = Class.forName(name, false, javaClass.classLoader)

    @Test
    fun `registers the application listeners on their topics`() {
        assertEquals(
            mapOf(
                AgentHubAppListener::class.java.name to "com.intellij.ide.AppLifecycleListener",
                AgentHubProjectCloseListener::class.java.name to "com.intellij.openapi.project.ProjectCloseListener",
                AgentHubVfsListener::class.java.name to "com.intellij.openapi.vfs.newvfs.BulkFileListener",
            ),
            listeners("applicationListeners"),
        )
    }

    @Test
    fun `registers the roots listener per project`() {
        assertEquals(
            mapOf(AgentHubRootsListener::class.java.name to "com.intellij.openapi.roots.ModuleRootListener"),
            listeners("projectListeners"),
        )
    }

    @Test
    fun `each listener implements its topic`() {
        for ((listener, topic) in listeners("applicationListeners") + listeners("projectListeners")) {
            assertTrue("$listener implements $topic", load(topic).isAssignableFrom(load(listener)))
        }
    }

    @Test
    fun `starts the hub with each project, without waiting for indexing`() {
        val activity = elements("extensions", "postStartupActivity").single().getAttribute("implementation")

        assertEquals(AgentHubStartupActivity::class.java.name, activity)
        assertTrue(ProjectActivity::class.java.isAssignableFrom(load(activity)))
        assertTrue(DumbAware::class.java.isAssignableFrom(load(activity)))
    }
}
