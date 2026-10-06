package com.github.dineug.erdeditorintellijplugin.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.State
import com.intellij.util.xmlb.XmlSerializer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Coding agents flag decides whether the hub serves this IDE at all, so its default, its
 * persistence and its separation from the theme state are pinned here, with no Application.
 */
class AgentHubSettingsTest {

    @Test
    fun `coding agents are on by default`() {
        assertTrue(AgentHubSettings().codingAgents)
        assertTrue(AgentHubSettings().state.codingAgents)
        assertTrue(AgentHubSettings.State().codingAgents)
    }

    @Test
    fun `loadState copies the stored value`() {
        val settings = AgentHubSettings()
        val stored = AgentHubSettings.State().apply { codingAgents = false }

        settings.loadState(stored)
        stored.codingAgents = true

        assertFalse(settings.codingAgents)
        assertFalse(settings.state.codingAgents)
    }

    @Test
    fun `a change publishes the new value once`() {
        val settings = AgentHubSettings()
        val published = mutableListOf<Boolean>()

        settings.update(true, published::add)
        settings.update(false, published::add)
        settings.update(false, published::add)
        settings.update(true, published::add)

        assertEquals(listOf(false, true), published)
        assertTrue(settings.codingAgents)
    }

    @Test
    fun `setting the current value never reaches the message bus`() {
        // No Application exists in a plain JUnit run, so a publish would throw here.
        assertNull(ApplicationManager.getApplication())
        val settings = AgentHubSettings()
        settings.codingAgents = true
        assertTrue(settings.codingAgents)
    }

    @Test
    fun `an unticked box is written and read back`() {
        fun roundTrip(state: AgentHubSettings.State) =
            XmlSerializer.deserialize(XmlSerializer.serialize(state), AgentHubSettings.State::class.java)

        assertFalse(roundTrip(AgentHubSettings.State().apply { codingAgents = false }).codingAgents)
        assertTrue(roundTrip(AgentHubSettings.State()).codingAgents)
    }

    @Test
    fun `is stored apart from the theme state`() {
        val hub = AgentHubSettings::class.java.getAnnotation(State::class.java)
        val theme = ErdEditorAppSettings::class.java.getAnnotation(State::class.java)

        assertEquals("com.github.dineug.erdeditorintellijplugin.settings.AgentHubSettings", hub.name)
        assertNotEquals(theme.name, hub.name)
        assertEquals(theme.storages.single().value, hub.storages.single().value)

        // Each component is read and written apart, so the flag must not be one of the theme's or
        // the display language's fields, nor one of those one of the flag's.
        val themeFields = ErdEditorAppSettings.State::class.java.declaredFields.map { it.name }.toSet()
        val hubFields = AgentHubSettings.State::class.java.declaredFields.map { it.name }.toSet()
        assertEquals(setOf("appearance", "grayColor", "accentColor", "locale"), themeFields)
        assertEquals(setOf("codingAgents"), hubFields)
    }
}
