package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Where the lock and the pipe live. The MCP server builds the same strings from the same home to
 * find a hub, so these are pinned byte for byte from the shared corpora, mixed Windows separators
 * included.
 */
class LockPathsTest {
    private val lock = Corpus.wire.lock
    private val pipes = Corpus.host.pipePath

    @Test
    fun `keeps the corpus bounds and modes`() {
        assertEquals(lock.maxPipePathBytes, LockPaths.MAX_PIPE_PATH_BYTES)
        assertEquals(lock.dirMode, LockPaths.LOCK_DIR_MODE)
        assertEquals(lock.fileMode, LockPaths.LOCK_FILE_MODE)
        assertEquals("700", Integer.toOctalString(LockPaths.LOCK_DIR_MODE))
        assertEquals("600", Integer.toOctalString(LockPaths.LOCK_FILE_MODE))
    }

    @Test
    fun `puts the lock under the home's erd-editor ide directory`() {
        for (case in lock.lockDirPath) assertEquals(case.home, case.dir, LockPaths.lockDirPath(case.home))
        for (case in lock.lockFilePath) assertEquals(case.home, case.path, LockPaths.lockFilePath(case.home, case.pid))
        assertEquals("/home/me/.erd-editor/ide/4242.json.tmp", LockPaths.lockTempPath("/home/me/", 4242))
    }

    @Test
    fun `reads a pid from a lock file name only`() {
        for (case in lock.lockFilePid) assertEquals(case.name, case.pid, LockPaths.lockFilePid(case.name))
    }

    @Test
    fun `names a socket beside the lock, or a named pipe on win32`() {
        for (case in lock.pipePath) {
            val pipe = LockPaths.pipePath(case.home, case.pid, case.platform)
            assertEquals("${case.home} on ${case.platform}", case.pipe, pipe)
        }
        for (case in lock.pipePathFits) {
            val fits = LockPaths.pipePathFits(case.pipe, case.platform)
            assertEquals("${case.pipe} on ${case.platform}", case.fits, fits)
        }
    }

    @Test
    fun `falls back to the temp directory, then to no pipe at all`() {
        for (case in pipes.tmpPipePath) assertEquals(case.tmp, case.pipe, LockPaths.tmpPipePath(case.tmp, case.pid))
        for (case in pipes.choosePipePath) {
            assertEquals(
                "${case.home} and ${case.tmp} on ${case.platform}",
                case.pipe,
                LockPaths.choosePipePath(case.home, case.tmp, case.pid, case.platform),
            )
        }
        for (case in pipes.socketFilePaths) {
            assertEquals(case.home, case.paths, LockPaths.socketFilePaths(case.home, case.tmp, case.pid, case.platform))
        }
    }

    @Test
    fun `binds a pipe of exactly 100 bytes beside the lock and one byte more under tmp`() {
        // 17 bytes of "/.erd-editor/ide/", 4 of the pid and 5 of ".sock" leave 74 for the home.
        val home = "/" + "h".repeat(73)
        assertEquals(100, LockPaths.pipePath(home, 4242, HubPlatform.LINUX).toByteArray().size)
        assertEquals("$home/.erd-editor/ide/4242.sock", LockPaths.choosePipePath(home, "/tmp", 4242, HubPlatform.LINUX))
        val over = LockPaths.choosePipePath("${home}h", "/tmp/", 4242, HubPlatform.DARWIN)
        assertEquals("/tmp/erd-editor-ide-4242.sock", over)

        // Bytes, not characters: 26 Hangul syllables are 78 bytes.
        val korean = "/" + "한".repeat(26)
        assertEquals(105, LockPaths.pipePath(korean, 4242, HubPlatform.LINUX).toByteArray().size)
        assertEquals("/tmp/erd-editor-ide-4242.sock", LockPaths.choosePipePath(korean, "/tmp", 4242, HubPlatform.LINUX))

        assertNull(LockPaths.choosePipePath("${home}h", "/" + "t".repeat(100), 4242, HubPlatform.LINUX))
        assertEquals(
            "\\\\.\\pipe\\erd-editor-ide-4242",
            LockPaths.choosePipePath("C:\\" + "h".repeat(200), "C:\\Temp", 4242, HubPlatform.WIN32),
        )
        val sockets = LockPaths.socketFilePaths("C:\\Users\\me", "C:\\Temp", 4242, HubPlatform.WIN32)
        assertEquals(emptyList<String>(), sockets)
    }
}
