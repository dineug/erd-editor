package com.github.dineug.erdeditorintellijplugin.agents

import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentRules
import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorConfigurable
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Where the hub runs at all: nowhere an ERD editor cannot, nor where no user or no pid the MCP server
 * sees would meet it. The service itself needs an Application; the smoke drives it.
 */
class AgentHubServiceTest {
    @Test
    fun `runs the hub where JCEF works in a desktop IDE outside a sandbox`() {
        assertNull(hubUnavailableReason({ true }, headless = false, unitTestMode = false) { false })
    }

    @Test
    fun `names the first reason that holds`() {
        assertEquals(DocumentRules.REASON_NO_JCEF, hubUnavailableReason({ false }, true, true) { true })
        assertEquals("a headless IDE", hubUnavailableReason({ true }, true, true) { true })
        assertEquals("unit-test mode", hubUnavailableReason({ true }, false, true) { true })
        assertEquals("a Flatpak sandbox", hubUnavailableReason({ true }, false, false) { true })
    }

    @Test
    fun `looks for a sandbox only when nothing else stops the hub`() {
        var looked = false

        hubUnavailableReason({ true }, headless = true, unitTestMode = false) { looked = true; true }

        assertFalse(looked)
        hubUnavailableReason({ true }, headless = false, unitTestMode = false) { looked = true; false }
        assertTrue(looked)
    }

    @Test
    fun `the settings page shows the reason as a second line of the switch's comment`() {
        val plain = ErdEditorConfigurable.agentsComment(null)

        assertTrue(plain.startsWith("Lets a coding agent's ERD Editor MCP server edit the diagrams"))
        assertFalse(plain.contains("unavailable"))
        assertEquals(
            "$plain<br>Coding agents are unavailable: a Flatpak sandbox",
            ErdEditorConfigurable.agentsComment("a Flatpak sandbox"),
        )
    }
}
