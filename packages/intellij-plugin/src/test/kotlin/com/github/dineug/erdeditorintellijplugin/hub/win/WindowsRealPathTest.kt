package com.github.dineug.erdeditorintellijplugin.hub.win

import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.MachineEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.RealPathResult
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.TimeUnit

/**
 * WindowsRealPath against the real kernel32, on Windows only: the final path of a handle, which
 * resolves a subst drive to its target as Node's realpath does and the JDK's toRealPath does not,
 * and MachineEnvironment's way on past MAX_PATH. The prefix rules and the NUL guard run everywhere.
 */
class WindowsRealPathTest {
    private val windows = HubPlatform.current().isWindows
    private val temps = ArrayList<Path>()
    private var substDrive: String? = null

    @After
    fun tearDown() {
        substDrive?.let { run("subst", it, "/D") }
        temps.forEach { it.toFile().deleteRecursively() }
    }

    @Test
    fun `strips the prefixes the final path carries, as libuv does`() {
        assertEquals("C:\\Users\\me", WindowsRealPath.stripFinalPathPrefix("\\\\?\\C:\\Users\\me"))
        assertEquals("\\\\server\\share\\ws", WindowsRealPath.stripFinalPathPrefix("\\\\?\\UNC\\server\\share\\ws"))
        assertNull(WindowsRealPath.stripFinalPathPrefix("\\Device\\HarddiskVolume1\\ws"))
    }

    @Test
    fun `refuses a path holding NUL before it opens anything`() {
        assertTrue(WindowsRealPath.realPath("C:\\ws\\a\u0000.erd.json") is RealPathResult.Other)
    }

    @Test
    fun `resolves a plain temp dir as toRealPath does`() {
        assumeTrue("Windows only", windows)
        val dir = tempDir()
        val file = Files.writeString(dir.resolve("a.erd.json"), "{}")

        assertEquals(RealPathResult.Ok(dir.toRealPath().toString()), WindowsRealPath.realPath(dir.toString()))
        assertEquals(RealPathResult.Ok(file.toRealPath().toString()), WindowsRealPath.realPath(file.toString()))
    }

    @Test
    fun `answers NotFound for a missing entry, under an existing folder or a missing one`() {
        assumeTrue("Windows only", windows)
        val dir = tempDir()

        assertEquals(RealPathResult.NotFound, WindowsRealPath.realPath(dir.resolve("none.erd.json").toString()))
        val underMissing = dir.resolve("none").resolve("b.erd.json").toString()
        assertEquals(RealPathResult.NotFound, WindowsRealPath.realPath(underMissing))
    }

    @Test
    fun `answers NotFound for a name Windows refuses, as libuv's ENOENT does`() {
        assumeTrue("Windows only", windows)
        val dir = tempDir()

        assertEquals(RealPathResult.NotFound, WindowsRealPath.realPath("$dir\\bad?name.erd.json"))
        assertEquals(RealPathResult.NotFound, WindowsRealPath.realPath("$dir\\bad?name\\a.erd.json"))
    }

    @Test
    fun `resolves a subst drive to its target, as Node's realpath does`() {
        assumeTrue("Windows only", windows)
        val dir = tempDir()
        Files.writeString(dir.resolve("a.erd.json"), "{}")
        val drive = ('Z' downTo 'D').map { "$it:" }.first { !File("$it\\").exists() }
        assertEquals(0, run("subst", drive, dir.toString()))
        substDrive = drive

        val real = WindowsRealPath.realPath("$drive\\a.erd.json")

        assertEquals(RealPathResult.Ok(dir.toRealPath().resolve("a.erd.json").toString()), real)
        nodeRealPath("$drive\\a.erd.json")?.let { node -> assertEquals(RealPathResult.Ok(node), real) }
    }

    @Test
    fun `resolves a path longer than MAX_PATH, which the native call may not open, as Node's hosts do`() {
        assumeTrue("Windows only", windows)
        val deep = Files.createDirectories(tempDir().resolve("d".repeat(120)).resolve("e".repeat(120)))
        val file = Files.writeString(deep.resolve("a.erd.json"), "{}")
        assertTrue("${file.toString().length} characters", file.toString().length > 260)
        val env = MachineEnvironment("C:\\Users\\me", "C:\\Temp", HubPlatform.WIN32, 1, "1.0.0")

        val real = env.realPath(file.toString())

        assertEquals(RealPathResult.Ok(file.toRealPath().toString()), real)
        assertEquals(RealPathResult.NotFound, env.realPath(deep.resolve("none.erd.json").toString()))
        nodeRealPath(file.toString())?.let { node -> assertEquals(RealPathResult.Ok(node), real) }
    }

    private fun tempDir(): Path = Files.createTempDirectory("hub-win-").also { temps.add(it) }

    private fun run(vararg command: String): Int {
        val process = ProcessBuilder(*command).redirectErrorStream(true).start()
        process.inputStream.readAllBytes()
        assertTrue(process.waitFor(30, TimeUnit.SECONDS))
        return process.exitValue()
    }

    /** What the MCP server would resolve the path to, when node runs on this machine; null otherwise. */
    private fun nodeRealPath(path: String): String? {
        val script = "console.log(require('fs').realpathSync.native(process.argv[1]))"
        val process = try {
            ProcessBuilder("node", "-e", script, path).start()
        } catch (e: IOException) {
            return null
        }
        val output = process.inputStream.readAllBytes().toString(Charsets.UTF_8).trim()
        assertTrue(process.waitFor(30, TimeUnit.SECONDS))
        return output.takeIf { process.exitValue() == 0 }
    }
}
