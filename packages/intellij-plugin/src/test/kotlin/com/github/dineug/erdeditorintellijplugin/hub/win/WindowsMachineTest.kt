package com.github.dineug.erdeditorintellijplugin.hub.win

import com.github.dineug.erdeditorintellijplugin.hub.HUB_PROTOCOL_VERSION
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.LockFile
import com.github.dineug.erdeditorintellijplugin.hub.LockPaths
import com.github.dineug.erdeditorintellijplugin.hub.LockRecord
import com.github.dineug.erdeditorintellijplugin.hub.MachineEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.NioFileSystem
import com.github.dineug.erdeditorintellijplugin.hub.ProcessQuery
import com.github.dineug.erdeditorintellijplugin.hub.serializeLock
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.win.testing.Integrity
import com.github.dineug.erdeditorintellijplugin.hub.win.testing.RestrictedToken
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import java.lang.ref.Reference
import java.nio.file.AccessDeniedException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * The machine layer against the real Windows, on Windows only, where every case runs and none skips,
 * as CI's test-windows job demands. Liveness asks WindowsProcess as this process and, on the test
 * thread, under restricted copies of its token (RestrictedToken): the integrity levels and accounts
 * an IDE meets, where ProcessHandle, the rule before, found no process. The lock write meets the
 * real refusal of a move over a lock another handle holds open.
 */
class WindowsMachineTest {
    private val own = ProcessHandle.current().pid()

    @Before
    fun setUp() {
        assumeTrue("Windows only", HubPlatform.current().isWindows)
        // kernel32 and the answers load here, as this process, before a lowered token could be refused them.
        assertEquals(ProcessQuery.Running, WindowsProcess.query(own.toInt()))
    }

    @After
    fun tearDown() {
        assertFalse("the real query never failed", MachineEnvironment.windowsLivenessFellBack)
    }

    @Test
    fun `answers Running for this process, and alive`() {
        assertTrue(MachineEnvironment.isAlive(own, HubPlatform.WIN32))
    }

    @Test
    fun `answers Exited for a child whose handle is still held, and NoSuchProcess for a pid no process has`() {
        val child = ProcessBuilder("cmd.exe", "/c", "exit", "3").start()
        assertTrue(child.waitFor(10, TimeUnit.SECONDS))

        assertEquals(ProcessQuery.Exited, WindowsProcess.query(child.pid().toInt()))
        assertFalse(MachineEnvironment.isAlive(child.pid(), HubPlatform.WIN32))
        assertEquals(ProcessQuery.NoSuchProcess, WindowsProcess.query(UNUSED_PID))
        assertFalse(MachineEnvironment.isAlive(UNUSED_PID.toLong(), HubPlatform.WIN32))
        // The JDK closes the child's handle once the Process is collected, and the pid goes with it.
        Reference.reachabilityFence(child)
    }

    @Test
    fun `sees this process from a Low token, where ProcessHandle finds none, as an IDE below a window would`() {
        RestrictedToken.impersonate(Integrity.LOW, denyAdministrators = false) {
            // ProcessHandle also asks for PROCESS_DUP_HANDLE, which no-write-up refuses any lower level.
            assertFalse(ProcessHandle.of(own).isPresent)
            assertEquals(ProcessQuery.Running, WindowsProcess.query(own.toInt()))
            assertTrue(MachineEnvironment.isAlive(own, HubPlatform.WIN32))
        }
    }

    @Test
    fun `sees this user's window from its unelevated token, elevated or not, and counts System dead there`() {
        val elevated = RestrictedToken.processIntegrityLevel() > MEDIUM_LEVEL

        RestrictedToken.impersonate(Integrity.MEDIUM, denyAdministrators = true) {
            assertEquals(ProcessQuery.Running, WindowsProcess.query(own.toInt()))
            assertTrue(MachineEnvironment.isAlive(own, HubPlatform.WIN32))
            // Where this JVM runs elevated, ProcessHandle found nothing, so an unelevated IDE swept its lock.
            assertEquals(elevated, !ProcessHandle.of(own).isPresent)
            // SYSTEM's, with no Administrators and no SeDebugPrivilege to open it: a pid reused there is dead.
            assertEquals(ProcessQuery.Denied, WindowsProcess.query(SYSTEM_PID))
            assertFalse(MachineEnvironment.isAlive(SYSTEM_PID.toLong(), HubPlatform.WIN32))
        }
    }

    @Test
    fun `lands a lock write once a reader holding the lock lets go, and gives up on one held past every delay`() {
        val dir = Files.createTempDirectory("hub-lock-").toRealPath()
        try {
            val env = MachineEnvironment(dir.resolve("home").toString(), dir.toString(), HubPlatform.WIN32, 4242, "0.0.0-test")
            NioFileSystem.makeDirectories(LockPaths.lockDirPath(env.homeDir), LockPaths.LOCK_DIR_MODE)
            val log = RecordingLog()
            val lock = LockFile(env, log, HubTimings().lockRenameDelaysMs) { delay(it) }
            val path = Path.of(lock.lockPath)
            Files.writeString(path, "the old lock")

            val reader = Files.newByteChannel(path, StandardOpenOption.READ)
            val letGo = thread {
                Thread.sleep(100)
                reader.close()
            }
            assertTrue(runBlocking { lock.write(RECORD) })
            letGo.join()
            assertEquals(serializeLock(RECORD), Files.readString(path))
            assertEquals(emptyList<String>(), log.texts)

            Files.newByteChannel(path, StandardOpenOption.READ).use {
                assertFalse(runBlocking { lock.write(RECORD.copy(hub = false)) })
            }
            assertEquals(serializeLock(RECORD), Files.readString(path))
            assertEquals(listOf("could not write ${lock.lockPath}"), log.texts)
            val refusal = log.lines.single().second
            assertTrue(refusal.toString(), refusal is AccessDeniedException)
        } finally {
            dir.toFile().deleteRecursively()
        }
    }

    private companion object {
        const val SYSTEM_PID = 4
        const val MEDIUM_LEVEL = 0x2000

        /** A multiple of four, as every pid is, far above any the kernel hands out. */
        const val UNUSED_PID = 99_999_996

        val RECORD = LockRecord(
            pipe = "\\\\.\\pipe\\erd-editor-ide-4242", workspaceFolders = emptyList(), documents = emptyList(),
            ide = "intellij", version = "0.0.0-test", protocolVersion = HUB_PROTOCOL_VERSION.toLong(),
            token = "secret", hub = true,
        )
    }
}
