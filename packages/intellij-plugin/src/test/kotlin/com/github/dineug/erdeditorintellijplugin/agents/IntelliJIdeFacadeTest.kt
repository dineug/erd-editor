package com.github.dineug.erdeditorintellijplugin.agents

import com.github.dineug.erdeditorintellijplugin.files.ErdEditorFiles
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Which project an agent's open lands in when no editor shows the file yet, under which spelling, and
 * which files the listing names. The trust rule itself is TrustSnapshotTest's, in the hub's core.
 */
class IntelliJIdeFacadeTest {
    private val linux = HubPlatform.LINUX

    @Test
    fun `opens in the project whose folder holds the file deepest`() {
        val candidates = listOf(
            "outer" to listOf("/work"),
            "inner" to listOf("/elsewhere", "/work/app"),
            "sibling" to listOf("/work/lib"),
        )

        assertEquals("inner", chooseProject(candidates, "/work/app/db/schema.erd", null, linux))
        assertEquals("outer", chooseProject(candidates, "/work/docs/schema.erd", null, linux))
    }

    @Test
    fun `the deepest folder wins over the last focused project`() {
        val candidates = listOf("outer" to listOf("/work"), "inner" to listOf("/work/app"))

        assertEquals("inner", chooseProject(candidates, "/work/app/schema.erd", "outer", linux))
    }

    @Test
    fun `a tie goes to the last focused project, else to the first`() {
        val candidates = listOf("a" to listOf("/work"), "b" to listOf("/other", "/work"), "c" to listOf("/work"))

        assertEquals("b", chooseProject(candidates, "/work/schema.erd", "b", linux))
        assertEquals("a", chooseProject(candidates, "/work/schema.erd", null, linux))
        assertEquals("a", chooseProject(candidates, "/work/schema.erd", "elsewhere", linux))
    }

    @Test
    fun `no project whose folder holds the file chooses none`() {
        val candidates = listOf("a" to listOf("/work"), "b" to emptyList())

        assertNull(chooseProject(candidates, "/outside/schema.erd", "a", linux))
        assertNull(chooseProject(emptyList<Pair<String, List<String>>>(), "/work/schema.erd", null, linux))
    }

    @Test
    fun `a folder is matched by whole segments, in the platform's case`() {
        val candidates = listOf("app" to listOf("/work/app"), "work" to listOf("/work"))

        assertEquals("work", chooseProject(candidates, "/work/application/schema.erd", null, linux))
        assertEquals("work", chooseProject(candidates, "/work/App/schema.erd", null, linux))
        assertEquals("app", chooseProject(candidates, "/work/App/schema.erd", null, HubPlatform.DARWIN))
        assertEquals(
            "app",
            chooseProject(
                listOf("app" to listOf("C:\\Work\\App"), "work" to listOf("C:\\Work")),
                "c:\\work\\app\\schema.erd",
                null,
                HubPlatform.WIN32,
            ),
        )
    }

    @Test
    fun `spells a real path under a symlinked root as the root is spelled`() {
        val folders = listOf(SpelledFolder("/home/me/link/proj", "/data/real/proj"))

        assertEquals("/home/me/link/proj/db/Schema.erd", spelledUnder(folders, "/data/real/proj/db/Schema.erd", linux))
        assertEquals("/home/me/link/proj", spelledUnder(folders, "/data/real/proj", linux))
        assertNull(spelledUnder(folders, "/data/real/Proj/a.erd", linux))
    }

    @Test
    fun `spells a real path under a subst or mapped drive as the project tree shows it`() {
        val win32 = HubPlatform.WIN32
        val subst = listOf(SpelledFolder("R:\\proj", "C:\\real\\proj"))
        val mapped = listOf(SpelledFolder("N:\\proj", "\\\\server\\share\\proj"))

        assertEquals("R:\\proj\\sub\\B.erd.json", spelledUnder(subst, "C:\\real\\proj\\sub\\B.erd.json", win32))
        assertEquals("R:\\proj\\a.erd", spelledUnder(subst, "c:\\REAL\\proj\\a.erd", win32))
        assertEquals("N:\\proj\\a.erd", spelledUnder(mapped, "\\\\server\\share\\proj\\a.erd", win32))
        assertEquals("R:\\a.erd", spelledUnder(listOf(SpelledFolder("R:\\", "C:\\real")), "C:\\real\\a.erd", win32))
        assertNull(spelledUnder(subst, "D:\\real\\proj\\a.erd", win32))
        assertNull(spelledUnder(subst, "C:\\real\\project\\a.erd", win32))
    }

    @Test
    fun `the deepest real folder spells the path, the first on a tie`() {
        val win32 = HubPlatform.WIN32
        val folders = listOf(
            SpelledFolder("R:\\", "C:\\real"),
            SpelledFolder("S:\\proj", "C:\\real\\proj"),
            SpelledFolder("T:\\proj\\", "c:\\real\\PROJ"),
        )

        assertEquals("S:\\proj\\a.erd", spelledUnder(folders, "C:\\real\\proj\\a.erd", win32))
        assertEquals("R:\\other\\a.erd", spelledUnder(folders, "C:\\real\\other\\a.erd", win32))
        assertNull(spelledUnder(emptyList(), "C:\\real\\a.erd", win32))
    }

    @Test
    fun `lists every extension the hub serves, whatever its letter case`() {
        for (name in listOf("schema.erd", "SCHEMA.ERD", "a.Erd.Json", "x.vuerd", "x.VUERD.json", ".erd")) {
            assertTrue(name, isListedErdName(name))
        }
    }

    @Test
    fun `lists no other file`() {
        for (name in listOf("x.json", "schema.json", "erd", "notes.md", "schema.erd.bak", "schema.erdx")) {
            assertFalse(name, isListedErdName(name))
        }
    }

    @Test
    fun `the listing serves what the ERD editor opens`() {
        assertEquals(ErdEditorFiles.EXTENSIONS, DocumentRules.ERD_FILE_EXTENSIONS)
    }
}
