package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeOp
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.nio.file.Files
import java.nio.file.NoSuchFileException

/** LockFile.cleanStale, the startup sweep of dead processes' locks, as agent-hub-host's lockFile.test.ts pins it. */
class StaleSweepTest {
    private val log = RecordingLog()

    @Test
    fun `deletes the lock, temp file and both possible sockets of a dead pid`() {
        val env = FakeEnvironment()
        env.fs.addDir("/tmp")
        seed(env, 100)
        env.fs.addFile("$LOCK_DIR/100.json.tmp")
        env.fs.addFile("$LOCK_DIR/100.sock")
        env.fs.addFile("/tmp/erd-editor-ide-100.sock")

        LockFile(env, log).cleanStale()

        assertEquals(emptyList<String>(), env.fs.files())
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `leaves the lock of a live process, even a malformed one that may be mid-write`() {
        val env = FakeEnvironment()
        env.alive += listOf(200L, 300L)
        seed(env, 200)
        seed(env, 300, "{\"pipe\":")
        env.fs.addFile("$LOCK_DIR/200.sock")

        LockFile(env, log).cleanStale()

        assertEquals(listOf("$LOCK_DIR/200.json", "$LOCK_DIR/300.json", "$LOCK_DIR/200.sock"), env.fs.files())
    }

    @Test
    fun `never touches its own lock or files that are not locks`() {
        val env = FakeEnvironment()
        env.alive -= env.pid
        seed(env, env.pid)
        val others = listOf("notes.txt", "4242.sock", "100.json.tmp", "0.json", "0042.json", "abc.json", ".json")
        env.fs.addFile("$LOCK_DIR/12.5.json")
        for (name in others) env.fs.addFile("$LOCK_DIR/$name")
        env.fs.addFile("$LOCK_DIR/99999999999999999999.json")

        LockFile(env, log).cleanStale()

        assertEquals(10, env.fs.files().size)
        assertEquals(emptyList<List<Any?>>(), env.fs.callsOf(FakeOp.IS_ALIVE))
        assertEquals(emptyList<List<Any?>>(), env.fs.callsOf(FakeOp.DELETE_IF_EXISTS))
    }

    @Test
    fun `skips a lock its process deleted between the listing and the read, and cleans the rest`() {
        val env = FakeEnvironment()
        env.alive += 500L
        seed(env, 500)
        seed(env, 100)
        env.fs.addFile("$LOCK_DIR/100.sock")
        seed(env, 101)
        env.fs.addFile("$LOCK_DIR/101.json.tmp")
        env.failNext(FakeOp.READ_TEXT, NoSuchFileException("$LOCK_DIR/500.json"))
        env.failNext(FakeOp.MTIME_MS, NoSuchFileException("$LOCK_DIR/100.json"))

        LockFile(env, log).cleanStale()

        assertEquals("$LOCK_DIR/500.json", env.fs.callsOf(FakeOp.READ_TEXT).first().single())
        // 500 went unread and 100 had no mtime: both are skipped; 101, dead, is cleaned.
        assertEquals(listOf("$LOCK_DIR/500.json", "$LOCK_DIR/100.json", "$LOCK_DIR/100.sock"), env.fs.files())
        assertEquals(listOf(listOf<Any?>(101L)), env.fs.callsOf(FakeOp.IS_ALIVE))
    }

    @Test
    fun `does nothing when the lock directory does not exist yet`() {
        val env = FakeEnvironment()

        LockFile(env, log).cleanStale()

        assertEquals(listOf(FakeOp.LIST_NAMES), env.fs.calls.map { it.op })
    }

    @Test
    fun `deletes no socket file on win32, where the pipe is no file`() {
        val env = FakeEnvironment(platform = HubPlatform.WIN32, tmpDir = "C:\\Temp")
        seed(env, 100)

        LockFile(env, log).cleanStale()

        assertEquals(
            listOf(listOf<Any?>("$LOCK_DIR/100.json"), listOf<Any?>("$LOCK_DIR/100.json.tmp")),
            env.fs.callsOf(FakeOp.DELETE_IF_EXISTS),
        )
    }

    @Test
    fun `asks liveness before it parses, so a malformed lock of a dead pid goes too`() {
        val env = FakeEnvironment()
        seed(env, 100, "not json")

        LockFile(env, log).cleanStale()

        assertFalse(env.fs.exists("$LOCK_DIR/100.json"))
    }

    @Test
    fun `keeps sweeping past a file it cannot delete, and gives up quietly when liveness itself fails`() {
        val env = FakeEnvironment()
        env.fs.addDir("/tmp")
        seed(env, 100)
        env.fs.addFile("$LOCK_DIR/100.sock")
        env.failNext(FakeOp.DELETE_IF_EXISTS, IOException("busy"))
        seed(env, 200)

        LockFile(env, log).cleanStale()

        assertEquals(listOf("$LOCK_DIR/100.json"), env.fs.files())

        seed(env, 300)
        env.failNext(FakeOp.IS_ALIVE, IllegalStateException("no process table"))
        LockFile(env, log).cleanStale()

        assertTrue(env.fs.exists("$LOCK_DIR/300.json"))
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `sweeps a lock whose pid no process can have, on the real file system`() {
        val dir = Files.createTempDirectory("hub-sweep-").toRealPath()
        try {
            val home = dir.resolve("home")
            val lockDir = Files.createDirectories(home.resolve(".erd-editor/ide"))
            val pid = ProcessHandle.current().pid()
            val env = MachineEnvironment(home.toString(), dir.toString(), HubPlatform.current(), pid, "0.0.0-test")
            val names = listOf("9007199254740991.json", "2147483648.json", "2147483648.json.tmp")
            for (name in names) Files.writeString(lockDir.resolve(name), "{}")
            val own = Files.writeString(lockDir.resolve("$pid.json"), "{}")

            LockFile(env, log).cleanStale()

            val left = Files.list(lockDir).use { list -> list.map { it.fileName.toString() }.toList() }
            assertEquals(listOf(own.fileName.toString()), left)
        } finally {
            dir.toFile().deleteRecursively()
        }
    }

    private fun seed(env: FakeEnvironment, pid: Long, raw: String = serializeLock(RECORD)) {
        env.fs.addFile("$LOCK_DIR/$pid.json", raw)
    }

    private companion object {
        const val LOCK_DIR = "/home/user/.erd-editor/ide"
        val RECORD = LockRecord(
            pipe = "$LOCK_DIR/4242.sock", workspaceFolders = listOf("/ws"), documents = emptyList(), ide = "vscode",
            version = "2.9.0", protocolVersion = 1, token = "secret", hub = true,
        )
    }
}
