package com.github.dineug.erdeditorintellijplugin.hub.document

import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * One lock serves every project of the IDE, trusted or not, so each write asks this snapshot
 * whether its path belongs only to projects the user never trusted. Where it cannot tell, a path
 * of the hub's scope that no open project covers, it fails closed.
 */
class TrustSnapshotTest {
    private val trusted = ProjectTrust(listOf("/work/app"), trusted = true)
    private val untrusted = ProjectTrust(listOf("/work/downloaded", "/elsewhere/second-root"), trusted = false)

    private fun snapshot(
        vararg projects: ProjectTrust,
        scope: List<String> = emptyList(),
        platform: HubPlatform = HubPlatform.LINUX,
    ) = TrustSnapshot(projects.toList(), scope, platform)

    @Test
    fun `refuses a path only untrusted projects hold`() {
        val scope = listOf("/work/app", "/work/downloaded", "/elsewhere/second-root")
        val snapshot = snapshot(trusted, untrusted, scope = scope)
        assertTrue(snapshot.untrustedOnly("/work/downloaded/a.erd"))
        assertTrue(snapshot.untrustedOnly("/elsewhere/second-root/deep/b.erd"))
        assertFalse(snapshot.untrustedOnly("/work/app/a.erd"))
    }

    @Test
    fun `lets a trusted project win over an untrusted one, nested either way`() {
        val outerUntrusted = ProjectTrust(listOf("/work"), trusted = false)
        val innerTrusted = ProjectTrust(listOf("/work/app"), trusted = true)
        assertFalse(snapshot(outerUntrusted, innerTrusted).untrustedOnly("/work/app/a.erd"))
        assertTrue(snapshot(outerUntrusted, innerTrusted).untrustedOnly("/work/other/a.erd"))

        val outerTrusted = ProjectTrust(listOf("/work"), trusted = true)
        val innerUntrusted = ProjectTrust(listOf("/work/downloaded"), trusted = false)
        assertFalse(snapshot(outerTrusted, innerUntrusted).untrustedOnly("/work/downloaded/a.erd"))
    }

    @Test
    fun `fails closed on a scope folder no open project covers`() {
        val snapshot = snapshot(trusted, scope = listOf("/work/app", "/work/closing"))
        assertTrue(snapshot.untrustedOnly("/work/closing/a.erd"))
        assertFalse(snapshot.untrustedOnly("/work/app/a.erd"))
    }

    @Test
    fun `leaves a document outside every folder alone`() {
        val snapshot = snapshot(trusted, untrusted, scope = listOf("/work/app"))
        assertFalse(snapshot.untrustedOnly("/tmp/scratch.erd"))
        assertFalse(snapshot().untrustedOnly("/tmp/scratch.erd"))
    }

    @Test
    fun `folds case where the platform does`() {
        val upper = ProjectTrust(listOf("/Work/Downloaded"), trusted = false)
        assertTrue(snapshot(upper, platform = HubPlatform.DARWIN).untrustedOnly("/work/downloaded/a.erd"))
        assertFalse(snapshot(upper, platform = HubPlatform.LINUX).untrustedOnly("/work/downloaded/a.erd"))

        val windows = ProjectTrust(listOf("C:\\Work\\App"), trusted = false)
        val snapshot = snapshot(windows, platform = HubPlatform.WIN32)
        assertTrue(snapshot.untrustedOnly("c:/work/app/a.erd"))
        assertEquals(HubPlatform.WIN32, snapshot.platform)
        assertEquals(listOf(windows), snapshot.projects)
        assertEquals(emptyList<String>(), snapshot.scopeFolders)
    }

    @Test
    fun `never reads a path with dot-dot as inside`() {
        val snapshot = snapshot(trusted, untrusted, scope = listOf("/work"))
        assertFalse(snapshot.untrustedOnly("/work/app/../downloaded/a.erd"))
    }
}
