package com.github.dineug.erdeditorintellijplugin.hub

import org.junit.Assert.assertEquals
import org.junit.Test
import java.text.Normalizer

/**
 * node:path's isAbsolute and join, as strings: the realpath climb decides on them before it
 * touches the file system, and Path.of would throw on a peer's string node:path takes as it is.
 */
class NodePathTest {

    @Test
    fun `reads an absolute path as node path does`() {
        val posix = mapOf(
            "/" to true, "/a" to true, "//a" to true, "" to false, "a" to false, "./a" to false,
            "C:\\a" to false, "\\a" to false, "/a\u0000b" to true,
        )
        for ((path, absolute) in posix) {
            assertEquals("posix $path", absolute, NodePath.isAbsolute(path, HubPlatform.LINUX))
            assertEquals("darwin $path", absolute, NodePath.isAbsolute(path, HubPlatform.DARWIN))
        }

        val win32 = mapOf(
            "C:\\a" to true, "C:/a" to true, "c:\\" to true, "\\\\server\\share\\x" to true, "\\x" to true,
            "/x" to true, "C:x" to false, "C:" to false, "" to false, "a\\b" to false, "1:\\a" to false,
            "Cx\\a" to false, "z:/" to true, "C:\u0000" to false,
        )
        for ((path, absolute) in win32) {
            assertEquals("win32 $path", absolute, NodePath.isAbsolute(path, HubPlatform.WIN32))
        }
    }

    @Test
    fun `joins a real prefix and a tail without doubling a separator`() {
        val posix = NodePath.joinReal("/real/ws", listOf("new", "b.erd.json"), HubPlatform.LINUX)
        assertEquals("/real/ws/new/b.erd.json", posix)
        assertEquals("/a.erd", NodePath.joinReal("/", listOf("a.erd"), HubPlatform.LINUX))
        assertEquals("/x/y", NodePath.joinReal("/x", listOf("", ".", "y", ""), HubPlatform.LINUX))
        assertEquals("/x", NodePath.joinReal("/x", emptyList(), HubPlatform.LINUX))
        val win32 = NodePath.joinReal("C:\\Real\\ws", listOf("new.erd.json"), HubPlatform.WIN32)
        assertEquals("C:\\Real\\ws\\new.erd.json", win32)
        assertEquals("C:\\a.erd", NodePath.joinReal("C:\\", listOf("a.erd"), HubPlatform.WIN32))
        assertEquals("C:/a.erd", NodePath.joinReal("C:/", listOf("a.erd"), HubPlatform.WIN32))
        assertEquals("\\\\srv\\share\\a.erd", NodePath.joinReal("\\\\srv\\share\\", listOf("a.erd"), HubPlatform.WIN32))
        // On POSIX a backslash is part of a name, so it neither ends the prefix nor joins.
        assertEquals("/a\\/b", NodePath.joinReal("/a\\", listOf("b"), HubPlatform.LINUX))
        assertEquals("a", NodePath.joinReal("", listOf("a"), HubPlatform.LINUX))
    }

    @Test
    fun `keeps the tail's code points as given`() {
        val nfc = Normalizer.normalize("한글.erd", Normalizer.Form.NFC)
        val nfd = Normalizer.normalize("한글.erd", Normalizer.Form.NFD)
        assertEquals("/ws/$nfc", NodePath.joinReal("/ws", listOf(nfc), HubPlatform.DARWIN))
        assertEquals("/ws/$nfd", NodePath.joinReal("/ws", listOf(nfd), HubPlatform.DARWIN))
    }
}
