package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The path rules both sides of the hub compare with, from the shared corpus: the MCP server
 * authorizes nothing itself, so a path this hub reads differently from packages/agent-hub's
 * paths.ts would let an agent reach a file the TypeScript hosts refuse, or the other way round.
 */
class HubPathsTest {
    private val paths = Corpus.wire.paths

    @Test
    fun `splits paths into segments`() {
        for (case in paths.toSegments) {
            val segments = HubPaths.toSegments(case.path, case.platform)
            assertEquals("${case.path} on ${case.platform}", case.segments, segments)
        }
    }

    @Test
    fun `finds a path inside a folder`() {
        for (case in paths.isInside) {
            assertEquals(
                "${case.child} inside ${case.parent} on ${case.platform}",
                case.result,
                HubPaths.isInside(case.parent, case.child, case.platform),
            )
        }
    }

    @Test
    fun `compares two paths`() {
        for (case in paths.isSamePath) {
            val same = HubPaths.isSamePath(case.a, case.b, case.platform)
            assertEquals("${case.a} is ${case.b} on ${case.platform}", case.result, same)
        }
    }

    @Test
    fun `picks the deepest folder, the first on a tie`() {
        for (case in paths.longestPrefixIndex) {
            assertEquals(
                "${case.target} in ${case.folders} on ${case.platform}",
                case.index,
                HubPaths.longestPrefixIndex(case.folders, case.target, case.platform),
            )
        }
    }

    @Test
    fun `authorizes a folder's content and the open documents`() {
        for (case in paths.isAuthorized) {
            assertEquals(
                "${case.target} with ${case.folders} and ${case.documents} on ${case.platform}",
                case.result,
                HubPaths.isAuthorized(case.folders, case.documents, case.target, case.platform),
            )
        }
    }

    @Test
    fun `refuses a path outside the workspace with the corpus refusal`() {
        for (case in paths.authorize) {
            val error = case.error
            if (error == null) {
                HubPaths.authorize(case.folders, case.documents, case.target, case.platform)
            } else {
                val refusal = assertThrows(HubRequestError::class.java) {
                    HubPaths.authorize(case.folders, case.documents, case.target, case.platform)
                }
                assertEquals(error.code, refusal.code.wire)
                assertEquals(error.message, refusal.message)
            }
        }
    }

    @Test
    fun `takes only an ASCII letter and a colon for a drive`() {
        assertEquals(listOf("1:", "a"), HubPaths.toSegments("1:\\a", HubPlatform.WIN32))
        assertFalse(HubPaths.isInside("1:\\a", "1:\\a\\b", HubPlatform.WIN32))
        assertEquals(listOf("ab", "c"), HubPaths.toSegments("ab\\c", HubPlatform.WIN32))
        assertEquals(listOf("c:", "x"), HubPaths.toSegments("C:/x", HubPlatform.WIN32))
        assertTrue(HubPaths.isInside("Z:\\", "z:\\a", HubPlatform.WIN32))
        assertFalse(HubPaths.isSamePath("C:\\a", "C:\\a\\..", HubPlatform.WIN32))
        assertFalse(HubPaths.isSamePath("/a/b", "", HubPlatform.LINUX))
    }

    @Test
    fun `reads a platform as Node names it`() {
        for (platform in HubPlatform.entries) assertEquals(platform, HubPlatform.of(platform.node))
        assertEquals(HubPlatform.OTHER, HubPlatform.of("freebsd"))
        assertEquals(HubPlatform.WIN32, HubPlatform.current("Windows 11"))
        assertEquals(HubPlatform.DARWIN, HubPlatform.current("Mac OS X"))
        assertEquals(HubPlatform.DARWIN, HubPlatform.current("Darwin"))
        assertEquals(HubPlatform.LINUX, HubPlatform.current("Linux"))
        assertEquals(HubPlatform.OTHER, HubPlatform.current("SunOS"))
        assertTrue(HubPlatform.current() in HubPlatform.entries)

        assertTrue(HubPlatform.WIN32.foldsCase && HubPlatform.WIN32.isWindows)
        assertTrue(HubPlatform.DARWIN.foldsCase && !HubPlatform.DARWIN.isWindows)
        assertFalse(HubPlatform.LINUX.foldsCase || HubPlatform.LINUX.isWindows)
        assertFalse(HubPlatform.OTHER.foldsCase || HubPlatform.OTHER.isWindows)
    }
}
