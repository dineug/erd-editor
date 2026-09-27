package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeFileSystem
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeOp
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.IOException
import java.nio.file.AccessDeniedException
import java.nio.file.FileSystemException
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermissions
import java.util.concurrent.CancellationException
import java.util.concurrent.CopyOnWriteArrayList

/**
 * LockFile's write, remove and removeSync, as agent-hub-host's lockFile.test.ts pins them: over the
 * memory file system for the calls, and over a temp home on the real one for modes and bytes. The
 * real Windows refusing a move over a held lock is WindowsMachineTest's.
 */
class LockFileTest {
    private val log = RecordingLog()
    private val temps = ArrayList<Path>()
    private val pauses = CopyOnWriteArrayList<Long>()

    @After
    fun tearDown() {
        temps.forEach { it.toFile().deleteRecursively() }
    }

    @Test
    fun `names its lock and temp file under the home's lock directory`() {
        val lock = LockFile(FakeEnvironment(), log)

        assertEquals(LOCK_DIR, lock.lockDir)
        assertEquals(LOCK, lock.lockPath)
        assertEquals("$LOCK.tmp", lock.tempPath)
    }

    @Test
    fun `writes a 0600 temp file, then renames it over the lock`() {
        val env = FakeEnvironment()
        env.fs.addDir(LOCK_DIR)

        assertTrue(LockFile(env, log).writeNow(RECORD))

        assertEquals(
            listOf(
                listOf<Any?>("$LOCK.tmp"),
                listOf<Any?>("$LOCK.tmp", serializeLock(RECORD), LockPaths.LOCK_FILE_MODE),
                listOf<Any?>("$LOCK.tmp", LOCK),
            ),
            env.fs.calls.map { it.args },
        )
        assertEquals(serializeLock(RECORD), env.fs.textOf(LOCK))
        assertEquals(LockPaths.LOCK_FILE_MODE, env.fs.modeOf(LOCK))
        assertFalse(env.fs.exists("$LOCK.tmp"))
    }

    @Test
    fun `deletes a leftover temp first, since writing over it would keep its mode`() {
        val env = FakeEnvironment()
        env.fs.addFile("$LOCK.tmp", "half a lock", mode = FakeFileSystem.DEFAULT_FILE_MODE)

        LockFile(env, log).writeNow(RECORD)

        assertEquals(serializeLock(RECORD), env.fs.textOf(LOCK))
        assertEquals(LockPaths.LOCK_FILE_MODE, env.fs.modeOf(LOCK))
    }

    @Test
    fun `answers false and only warns when the temp file cannot be written`() {
        val env = FakeEnvironment()

        assertFalse(LockFile(env, log).writeNow(RECORD))

        assertEquals(emptyList<List<Any?>>(), env.fs.callsOf(FakeOp.MOVE_REPLACING))
        assertEquals(listOf("could not write $LOCK"), log.texts)
        assertTrue(log.lines.single().second is NoSuchFileException)
    }

    @Test
    fun `leaves the temp file behind a failed rename, and the next write clears it`() {
        val env = FakeEnvironment()
        env.fs.addDir(LOCK_DIR)
        val error = IOException("rename failed")
        env.failNext(FakeOp.MOVE_REPLACING, error)
        val lock = LockFile(env, log)

        assertFalse(lock.writeNow(RECORD))
        assertTrue(env.fs.exists("$LOCK.tmp"))
        assertEquals(listOf("could not write $LOCK" to error), log.lines)

        assertTrue(lock.writeNow(RECORD.copy(hub = false)))
        assertFalse(env.fs.exists("$LOCK.tmp"))
        assertEquals(serializeLock(RECORD.copy(hub = false)), env.fs.textOf(LOCK))
    }

    @Test
    fun `moves again after each delay while Windows refuses a move for a held lock, and lands`() {
        val env = windows()
        env.failNext(FakeOp.MOVE_REPLACING, AccessDeniedException(LOCK))
        // A held temp file: the JDK's reason text is localized, so only the exact class tells.
        env.failNext(FakeOp.MOVE_REPLACING, FileSystemException("$LOCK.tmp"))

        assertTrue(retrying(env).writeNow(RECORD))

        assertEquals(3, env.fs.callsOf(FakeOp.MOVE_REPLACING).size)
        assertEquals(listOf(10L, 20L), pauses)
        assertEquals(serializeLock(RECORD), env.fs.textOf(LOCK))
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `gives up once every delay passed, warns once and leaves the old lock`() {
        val env = windows().apply { fs.addFile(LOCK, "the old lock") }
        val refused = List(DELAYS.size + 1) { AccessDeniedException(LOCK) }
        refused.forEach { env.failNext(FakeOp.MOVE_REPLACING, it) }

        assertFalse(retrying(env).writeNow(RECORD))

        assertEquals(DELAYS.size + 1, env.fs.callsOf(FakeOp.MOVE_REPLACING).size)
        assertEquals(DELAYS, pauses)
        assertEquals("the old lock", env.fs.textOf(LOCK))
        assertEquals(listOf("could not write $LOCK" to refused.last()), log.lines)
    }

    @Test
    fun `moves once for any other failure, and for a refusal off Windows`() {
        val failures = listOf(
            windows() to NoSuchFileException("$LOCK.tmp"),
            windows() to IOException("the disk is gone"),
            FakeEnvironment().apply { fs.addDir(LOCK_DIR) } to AccessDeniedException(LOCK),
        )
        for ((env, error) in failures) {
            env.failNext(FakeOp.MOVE_REPLACING, error)

            assertFalse(retrying(env).writeNow(RECORD))

            assertEquals(error.toString(), 1, env.fs.callsOf(FakeOp.MOVE_REPLACING).size)
        }
        assertEquals(emptyList<Long>(), pauses)
        assertEquals(List(3) { "could not write $LOCK" }, log.texts)
    }

    @Test
    fun `rethrows a cancellation that comes while it waits out a held lock, and logs nothing`() {
        val env = windows()
        env.failNext(FakeOp.MOVE_REPLACING, AccessDeniedException(LOCK))
        val waiting = CompletableDeferred<Unit>()
        val lock = LockFile(env, log, DELAYS) {
            waiting.complete(Unit)
            awaitCancellation()
        }

        val cancelled = runBlocking {
            val writing = async { lock.write(RECORD) }
            waiting.await()
            writing.cancel()
            runCatching { writing.await() }.exceptionOrNull()
        }

        assertTrue(cancelled.toString(), cancelled is CancellationException)
        assertEquals(1, env.fs.callsOf(FakeOp.MOVE_REPLACING).size)
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `deletes the lock and its temp file, and is quiet when neither exists or one cannot go`() {
        val env = FakeEnvironment()
        env.fs.addFile(LOCK)
        env.fs.addFile("$LOCK.tmp")
        val lock = LockFile(env, log)

        lock.remove()
        lock.remove()
        assertEquals(emptyList<String>(), env.fs.files())

        env.fs.addFile(LOCK)
        env.fs.addFile("$LOCK.tmp")
        env.failNext(FakeOp.DELETE_IF_EXISTS, IOException("busy"))
        lock.remove()

        assertEquals(listOf(LOCK), env.fs.files())
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `deletes the lock and its temp file before it returns, and never throws when neither exists`() {
        val env = FakeEnvironment()
        env.fs.addFile(LOCK)
        env.fs.addFile("$LOCK.tmp")
        val lock = LockFile(env, log)

        lock.removeSync()
        assertEquals(emptyList<String>(), env.fs.files())
        lock.removeSync()

        assertEquals(
            listOf(LOCK, "$LOCK.tmp", LOCK, "$LOCK.tmp").map { listOf<Any?>(it) },
            env.fs.callsOf(FakeOp.REMOVE_FILE_SYNC),
        )
    }

    @Test
    fun `writes the exact bytes of every corpus lock record on the real file system`() {
        val (env, lockDir) = realHome()
        val lock = LockFile(env, log)

        for (case in Corpus.wire.lock.serialize) {
            assertTrue(lock.writeNow(case.record))
            val written = Files.readAllBytes(Path.of(lock.lockPath))
            assertArrayEquals(case.text, case.text.toByteArray(Charsets.UTF_8), written)
        }
        val names = Files.list(lockDir).use { list -> list.map { it.fileName.toString() }.toList() }
        assertEquals(listOf("${env.pid}.json"), names)
    }

    @Test
    fun `gives the lock 0600 on the real file system, even over a leftover temp file readable by others`() {
        assumeTrue("POSIX modes", "posix" in Path.of("").fileSystem.supportedFileAttributeViews())
        val (env, lockDir) = realHome()
        val temp = Files.writeString(lockDir.resolve("${env.pid}.json.tmp"), "half a lock")
        Files.setPosixFilePermissions(temp, PosixFilePermissions.fromString("rw-r--r--"))

        assertTrue(LockFile(env, log).writeNow(RECORD))

        val lock = Path.of(LockFile(env, log).lockPath)
        assertEquals(PosixFilePermissions.fromString("rw-------"), Files.getPosixFilePermissions(lock))
        assertEquals(serializeLock(RECORD), Files.readString(lock))
        assertFalse(Files.exists(temp))
    }

    @Test
    fun `fails to write into a lock directory that is not there, on the real file system`() {
        val env = machine(Files.createTempDirectory("hub-lock-").toRealPath().also { temps.add(it) })
        val lock = LockFile(env, log)

        assertFalse(lock.writeNow(RECORD))

        assertEquals(listOf("could not write ${lock.lockPath}"), log.texts)
        assertTrue(log.lines.single().second is NoSuchFileException)
        lock.remove()
        lock.removeSync()
        assertNull(NioFileSystem.listNames(lock.lockDir))
    }

    private fun LockFile.writeNow(record: LockRecord): Boolean = runBlocking { write(record) }

    /** The memory machine as Windows, its lock directory made. */
    private fun windows() = FakeEnvironment(platform = HubPlatform.WIN32).apply { fs.addDir(LOCK_DIR) }

    /** The production delays, each recorded in pauses instead of waited out. */
    private fun retrying(env: FakeEnvironment) = LockFile(env, log, DELAYS) { pauses += it }

    /** A temp home whose lock directory exists, the way the hub creates it before its first write. */
    private fun realHome(): Pair<MachineEnvironment, Path> {
        val env = machine(Files.createTempDirectory("hub-lock-").toRealPath().also { temps.add(it) })
        NioFileSystem.makeDirectories(LockPaths.lockDirPath(env.homeDir), LockPaths.LOCK_DIR_MODE)
        return env to Path.of(LockPaths.lockDirPath(env.homeDir))
    }

    private fun machine(dir: Path) =
        MachineEnvironment(dir.resolve("home").toString(), dir.toString(), HubPlatform.current(), 4242, "0.0.0-test")

    private companion object {
        const val LOCK_DIR = "/home/user/.erd-editor/ide"
        const val LOCK = "$LOCK_DIR/4242.json"
        val DELAYS = HubTimings().lockRenameDelaysMs
        val RECORD = LockRecord(
            pipe = "$LOCK_DIR/4242.sock", workspaceFolders = listOf("/ws"), documents = emptyList(), ide = "intellij",
            version = "0.0.0-test", protocolVersion = HUB_PROTOCOL_VERSION.toLong(), token = "secret", hub = true,
        )
    }
}
