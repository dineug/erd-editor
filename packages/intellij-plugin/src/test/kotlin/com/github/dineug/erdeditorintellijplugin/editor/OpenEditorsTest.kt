package com.github.dineug.erdeditorintellijplugin.editor

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The editors of a file the hub's registry does not hold (one outside the local file system, or
 * renamed to another extension and back) relay among themselves, and a new page of theirs starts
 * from what they hold, never from the storage form on disk, which lacks the removed entities an
 * undo brings back.
 */
class OpenEditorsTest {
    private val file = "a.erd"
    private val disk = """{"stored":true}"""
    private val runtime = """{"runtime":1}"""
    private val editors = OpenEditors<String, String>()

    @Test
    fun `a new page starts from the runtime value a sibling saved, ahead of the file`() {
        editors.open(file, "first")
        editors.saved(file, "first", runtime)
        editors.open(file, "second")

        assertEquals(runtime, editors.seed(file, disk))
    }

    @Test
    fun `a page that reloads starts from the runtime value its own page saved`() {
        editors.open(file, "only")
        editors.saved(file, "only", runtime)

        assertEquals(runtime, editors.seed(file, disk))
    }

    @Test
    fun `the latest save of any editor of the file wins`() {
        editors.open(file, "first")
        editors.open(file, "second")
        editors.saved(file, "first", runtime)
        editors.saved(file, "second", """{"runtime":2}""")

        assertEquals("""{"runtime":2}""", editors.seed(file, disk))
    }

    @Test
    fun `with no runtime value saved, or only saves from an older bundle, a page starts from the file`() {
        editors.open(file, "first")
        assertEquals(disk, editors.seed(file, disk))

        editors.saved(file, "first", null)
        assertEquals(disk, editors.seed(file, disk))
        assertEquals(disk, editors.seed("unopened.erd", disk))
    }

    @Test
    fun `a save without a runtime value keeps the last one`() {
        editors.open(file, "first")
        editors.saved(file, "first", runtime)
        editors.saved(file, "first", null)

        assertEquals(runtime, editors.seed(file, disk))
    }

    @Test
    fun `the last editor closing takes the runtime value with it, so a page opened later reads the file`() {
        editors.open(file, "first")
        editors.saved(file, "first", runtime)
        editors.close(file, "first")
        editors.open(file, "second")

        assertEquals(disk, editors.seed(file, disk))
    }

    @Test
    fun `an editor still open keeps the runtime value when a sibling closes`() {
        editors.open(file, "first")
        editors.open(file, "second")
        editors.saved(file, "first", runtime)
        editors.close(file, "first")

        assertEquals(runtime, editors.seed(file, disk))
    }

    @Test
    fun `a save from an editor not open on the file, as one already closed, reaches no page`() {
        editors.open(file, "first")
        editors.close(file, "first")
        editors.saved(file, "first", runtime)
        editors.open(file, "second")
        editors.saved(file, "first", runtime)

        assertEquals(disk, editors.seed(file, disk))
    }

    @Test
    fun `each file keeps its own editors and runtime value`() {
        editors.open(file, "first")
        editors.open("b.erd", "other")
        editors.saved("b.erd", "other", runtime)

        assertEquals(disk, editors.seed(file, disk))
        assertEquals(runtime, editors.seed("b.erd", disk))
        assertEquals(listOf("first"), editors.editors(file))
    }

    @Test
    fun `editors lists the file's open editors, none once the last closes`() {
        editors.open(file, "first")
        editors.open(file, "second")
        editors.open(file, "second")
        assertEquals(setOf("first", "second"), editors.editors(file).toSet())
        assertEquals(2, editors.editors(file).size)

        editors.close(file, "first")
        assertEquals(listOf("second"), editors.editors(file))

        editors.close(file, "second")
        editors.close(file, "second")
        assertEquals(emptyList<String>(), editors.editors(file))
        assertEquals(emptyList<String>(), editors.editors("unopened.erd"))
    }
}
