package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.nio.file.FileAlreadyExistsException
import java.nio.file.FileSystemException
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermissions
import java.text.Normalizer
import java.util.Properties
import java.util.concurrent.TimeUnit

/**
 * The machine layer against the real file system under a temp dir, and the Node rules for home,
 * temp directory and liveness through injected env maps and primitives. This suite alone may name
 * the real home's property: forMachine always gets its env and props here.
 */
class MachineEnvironmentTest {
    private lateinit var dir: Path
    private lateinit var env: MachineEnvironment
    private val platform = HubPlatform.current()
    private val posix = "posix" in Path.of("").fileSystem.supportedFileAttributeViews()

    @Before
    fun setUp() {
        dir = Files.createTempDirectory("hub-env-").toRealPath()
        env = MachineEnvironment(dir.resolve("home").toString(), dir.toString(), platform, 4242, "2.9.0")
    }

    @After
    fun tearDown() {
        MachineEnvironment.livenessFellBack = false
        dir.toFile().deleteRecursively()
    }

    @Test
    fun `reads the home, temp directory and pid of the machine and carries the version it is given`() {
        val props = Properties().apply {
            setProperty("user.home", "/Users/account")
            setProperty("java.io.tmpdir", "/var/folders/x/T/")
        }
        val machine = MachineEnvironment.forMachine(
            "2.9.0",
            env = mapOf("HOME" to "/home/me", "TMPDIR" to "/var/t/"),
            props = props,
            platform = HubPlatform.LINUX,
        )

        assertEquals("/home/me", machine.homeDir)
        assertEquals("/var/t", machine.tmpDir)
        assertEquals(HubPlatform.LINUX, machine.platform)
        assertEquals(ProcessHandle.current().pid(), machine.pid)
        assertEquals("2.9.0", machine.version)
        assertSame(NioFileSystem, machine.fs)
        assertSame(HubClock.monotonic, machine.clock)

        val bare = MachineEnvironment.forMachine("3.0.0", env = emptyMap(), props = Properties())
        assertEquals("", bare.homeDir)
        assertEquals(HubPlatform.current(), bare.platform)
    }

    @Test
    fun `resolves the home as Node's os homedir does`() {
        fun home(platform: HubPlatform, vararg env: Pair<String, String>) =
            MachineEnvironment.nodeHomeDir(platform, mapOf(*env), "/Users/account")

        assertEquals("/home/me", home(HubPlatform.LINUX, "HOME" to "/home/me"))
        assertEquals("", home(HubPlatform.DARWIN, "HOME" to ""))
        assertEquals("/Users/account", home(HubPlatform.DARWIN))
        assertEquals("/Users/account", home(HubPlatform.LINUX, "USERPROFILE" to "C:\\Users\\me"))
        assertEquals("C:\\Users\\me", home(HubPlatform.WIN32, "USERPROFILE" to "C:\\Users\\me", "HOME" to "/home/me"))
        assertEquals("/Users/account", home(HubPlatform.WIN32, "HOME" to "/home/me"))
        // Windows finds a variable in any case, as process.env does there; POSIX only in its own.
        assertEquals("C:\\Users\\me", home(HubPlatform.WIN32, "UserProfile" to "C:\\Users\\me"))
        assertEquals("/Users/account", home(HubPlatform.LINUX, "home" to "/home/me"))
    }

    @Test
    fun `resolves the temp directory as Node's os tmpdir does`() {
        fun tmp(platform: HubPlatform, vararg env: Pair<String, String>) =
            MachineEnvironment.nodeTmpDir(platform, mapOf(*env), "C:\\Users\\me\\AppData\\Local\\Temp\\")

        assertEquals("/var/t", tmp(HubPlatform.DARWIN, "TMPDIR" to "/var/t/"))
        assertEquals("/var/t/", tmp(HubPlatform.LINUX, "TMPDIR" to "/var/t//"))
        assertEquals("/", tmp(HubPlatform.LINUX, "TMPDIR" to "/"))
        assertEquals("/tmp2", tmp(HubPlatform.LINUX, "TMPDIR" to "", "TMP" to "/tmp2", "TEMP" to "/tmp3"))
        assertEquals("/tmp3", tmp(HubPlatform.LINUX, "TEMP" to "/tmp3/"))
        assertEquals("/tmp", tmp(HubPlatform.LINUX))
        assertEquals("/tmp", tmp(HubPlatform.LINUX, "TEMP" to ""))

        assertEquals("C:\\Temp", tmp(HubPlatform.WIN32, "TEMP" to "C:\\Temp\\", "TMP" to "D:\\Tmp"))
        assertEquals("C:\\", tmp(HubPlatform.WIN32, "TEMP" to "C:\\"))
        assertEquals("\\", tmp(HubPlatform.WIN32, "TEMP" to "\\"))
        assertEquals("D:\\Tmp/", tmp(HubPlatform.WIN32, "TEMP" to "", "TMP" to "D:\\Tmp/"))
        assertEquals("C:\\Windows\\temp", tmp(HubPlatform.WIN32, "SystemRoot" to "C:\\Windows", "windir" to "D:\\W"))
        assertEquals("D:\\W\\temp", tmp(HubPlatform.WIN32, "SystemRoot" to "", "windir" to "D:\\W"))
        assertEquals("C:\\Users\\me\\AppData\\Local\\Temp", tmp(HubPlatform.WIN32, "TMPDIR" to "/var/t"))

        assertEquals("C:\\T", tmp(HubPlatform.WIN32, "temp" to "C:\\T\\", "TMP" to "D:\\Tmp"))
        assertEquals("C:\\Windows\\temp", tmp(HubPlatform.WIN32, "SYSTEMROOT" to "C:\\Windows", "windir" to "D:\\W"))
        assertEquals("/tmp", tmp(HubPlatform.LINUX, "tmpdir" to "/var/t"))
    }

    @Test
    fun `finds a Flatpak sandbox on Linux only`() {
        assertTrue(MachineEnvironment.pidSandbox(HubPlatform.LINUX, mapOf("FLATPAK_ID" to "com.example.Ide"), false))
        assertTrue(MachineEnvironment.pidSandbox(HubPlatform.LINUX, emptyMap(), true))
        assertFalse(MachineEnvironment.pidSandbox(HubPlatform.LINUX, mapOf("FLATPAK_ID" to ""), false))
        assertFalse(MachineEnvironment.pidSandbox(HubPlatform.DARWIN, mapOf("FLATPAK_ID" to "x"), true))
    }

    @Test
    fun `hands out a fresh UUID token on every call`() {
        val first = env.randomToken()

        assertTrue(first, UUID_V4.matches(first))
        assertNotEquals(first, env.randomToken())
    }

    @Test
    fun `tells this live process from one that has exited, through the platform's own signal`() {
        val exited = exitedPid()

        assertTrue(env.isAlive(ProcessHandle.current().pid()))
        assertFalse(env.isAlive(exited))
        // Neither answer came from the ProcessHandle fallback: the JNA natives load in plain JUnit.
        assertFalse(MachineEnvironment.livenessFellBack)
    }

    @Test
    fun `asks ProcessHandle on Windows`() {
        val signal = { _: Int -> throw AssertionError("no signal on Windows") }

        assertTrue(MachineEnvironment.isAlive(ProcessHandle.current().pid(), HubPlatform.WIN32, signal))
        assertFalse(MachineEnvironment.isAlive(exitedPid(), HubPlatform.WIN32, signal))
    }

    @Test
    fun `counts a pid it may not signal dead on POSIX, as a lock never names another user's process`() {
        val log = RecordingLog()

        assertFalse(MachineEnvironment.isAlive(4, HubPlatform.DARWIN, { -1 }, log))
        val refused = { _: Int -> throw IllegalArgumentException("Invalid PID") }

        assertFalse(MachineEnvironment.isAlive(4, HubPlatform.LINUX, refused, log))
        assertTrue(MachineEnvironment.isAlive(4, HubPlatform.LINUX, { 0 }, log))
        assertEquals(emptyList<String>(), log.texts)
        assertFalse(MachineEnvironment.livenessFellBack)
    }

    @Test
    fun `counts a pid no process can have dead without asking, on every platform`() {
        val signal = { _: Int -> throw AssertionError("asked about an impossible pid") }

        for (platform in HubPlatform.entries) {
            for (pid in listOf(9_007_199_254_740_991L, 2_147_483_648L, 0L, -1L)) {
                assertFalse("$pid on $platform", MachineEnvironment.isAlive(pid, platform, signal))
            }
        }
    }

    @Test
    fun `falls back to ProcessHandle for good once the signal primitive fails, and says so once`() {
        val log = RecordingLog()
        var signals = 0
        val broken = { _: Int ->
            signals++
            throw IllegalStateException("Couldn't load c library")
        }
        val own = ProcessHandle.current().pid()

        assertTrue(MachineEnvironment.isAlive(own, HubPlatform.LINUX, broken, log))
        assertFalse(MachineEnvironment.isAlive(exitedPid(), HubPlatform.DARWIN, broken, log))
        assertTrue(MachineEnvironment.livenessFellBack)
        assertEquals(1, signals)
        assertEquals(
            listOf("liveness falls back to ProcessHandle: java.lang.IllegalStateException: Couldn't load c library"),
            log.texts,
        )
    }

    @Test
    fun `says once through the log it was built with that liveness fell back`() {
        val own = ProcessHandle.current().pid()
        val built = listOf<(RecordingLog) -> MachineEnvironment>(
            { log -> MachineEnvironment("/home/me", "/tmp", HubPlatform.LINUX, 1, "1.0.0", log = log) },
            { log ->
                MachineEnvironment.forMachine(
                    "1.0.0", env = emptyMap(), props = Properties(), platform = HubPlatform.DARWIN, log = log,
                )
            },
        )

        for (build in built) {
            MachineEnvironment.livenessFellBack = false
            val log = RecordingLog()
            val machine = build(log)
            var signals = 0
            machine.posixSignal0 = {
                signals++
                throw IllegalStateException("Couldn't load c library")
            }

            assertTrue(machine.isAlive(own))
            assertFalse(machine.isAlive(exitedPid()))
            assertEquals(1, signals)
            assertEquals(
                listOf("liveness falls back to ProcessHandle: java.lang.IllegalStateException: Couldn't load c library"),
                log.texts,
            )
        }
    }

    @Test
    fun `falls back quietly without a log, and a log it gets later hears nothing, since this JVM fell back once`() {
        val own = ProcessHandle.current().pid()
        val quiet = MachineEnvironment("/home/me", "/tmp", HubPlatform.LINUX, 1, "1.0.0")
        quiet.posixSignal0 = { throw UnsatisfiedLinkError() }

        assertTrue(quiet.isAlive(own))
        assertTrue(MachineEnvironment.livenessFellBack)

        val log = RecordingLog()
        val later = MachineEnvironment("/home/me", "/tmp", HubPlatform.LINUX, 1, "1.0.0", log = log)
        later.posixSignal0 = { throw AssertionError("asked the primitive after it failed") }

        assertTrue(later.isAlive(own))
        assertFalse(later.isAlive(exitedPid()))
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `resolves a real path, and tells a missing entry from any other failure`() {
        val file = Files.writeString(dir.resolve("a.erd.json"), "{}")

        assertEquals(RealPathResult.Ok(file.toString()), env.realPath(file.toString()))
        assertEquals(RealPathResult.NotFound, env.realPath(dir.resolve("none.erd.json").toString()))
        assertEquals(RealPathResult.NotFound, env.realPath(""))
        // Windows answers a path under a file as missing (ERROR_PATH_NOT_FOUND), as libuv does.
        val underFile = env.realPath(file.resolve("under-a-file").toString())
        val missing = underFile == RealPathResult.NotFound
        assertTrue("$underFile", if (platform.isWindows) missing else underFile is RealPathResult.Other)
        // A NUL is a string no file system takes: Path.of throws, and authorization gets no real path.
        assertTrue(env.realPath("$dir/a\u0000.erd.json") is RealPathResult.Other)
    }

    @Test
    fun `resolves a Windows path through the handle's final path, and through the JDK where kernel32 is missing`() {
        val windows = MachineEnvironment("C:\\Users\\me", "C:\\Temp", HubPlatform.WIN32, 1, "1.0.0")
        val file = Files.writeString(dir.resolve("a.erd.json"), "{}")

        // Off Windows the native call cannot load, so the JDK's answer is the one that comes back.
        assertEquals(RealPathResult.Ok(file.toString()), windows.realPath(file.toString()))
        assertEquals(RealPathResult.NotFound, windows.realPath("${dir}\\missing\\a.erd.json"))
    }

    @Test
    fun `goes on to the JDK's real path on Windows when the native one finds none, as Node's hosts do`() {
        val file = Files.writeString(dir.resolve("a.erd.json"), "{}").toString()
        val none = dir.resolve("none.erd.json").toString()
        val nul = "$dir/a\u0000.erd.json"
        val underFile = Path.of(file, "under-a-file").toString()
        val windows = MachineEnvironment("C:\\Users\\me", "C:\\Temp", HubPlatform.WIN32, 1, "1.0.0")
        val asked = ArrayList<String>()
        fun answering(native: RealPathResult) {
            windows.windowsRealPath = { path -> native.also { asked += path } }
        }

        answering(RealPathResult.NotFound)
        assertEquals(RealPathResult.Ok(file), windows.realPath(file))
        assertEquals(RealPathResult.NotFound, windows.realPath(none))
        // Missing to libuv and refused by the JDK: missing, as the JS realpath's lstat says.
        assertEquals(RealPathResult.NotFound, windows.realPath(nul))
        assertEquals(RealPathResult.NotFound, windows.realPath(underFile))
        answering(RealPathResult.Other(IOException("GetFinalPathNameByHandleW failed")))
        assertEquals(RealPathResult.Ok(file), windows.realPath(file))
        val refused = windows.realPath(nul)
        assertTrue("$refused", refused is RealPathResult.Other && refused.cause !is IOException)
        // A real path from the handle stands, subst drive resolved and all.
        answering(RealPathResult.Ok("D:\\ws\\a.erd.json"))
        assertEquals(RealPathResult.Ok("D:\\ws\\a.erd.json"), windows.realPath(file))
        assertEquals(RealPathResult.NotFound, windows.realPath(""))
        assertEquals(listOf(file, none, nul, underFile, file, nul, file), asked)

        val posix = MachineEnvironment("/home/me", "/tmp", HubPlatform.LINUX, 1, "1.0.0")
        posix.windowsRealPath = { throw AssertionError("asked the Windows realpath on POSIX") }
        assertEquals(RealPathResult.Ok(file), posix.realPath(file))
    }

    @Test
    fun `resolves a path to its spelling on disk, as the MCP server does`() {
        Files.createDirectory(dir.resolve("CaseDir"))
        val spelled = Files.writeString(dir.resolve("CaseDir").resolve("Doc.erd.json"), "{}").toString()
        val typed = dir.resolve("casedir").resolve("doc.ERD.json").toString()
        // A case-insensitive disk (macOS, Windows) finds the file either way.
        val found = Files.exists(Path.of(typed))

        assertEquals(if (found) RealPathResult.Ok(spelled) else RealPathResult.NotFound, env.realPath(typed))
        assertEquals(if (found) spelled else typed, Authz(env).realpathOrSelf(typed))
    }

    @Test
    fun `resolves a folder named in the other Unicode normalization to its name on disk`() {
        val onDisk = Files.createDirectory(dir.resolve(nfd("프로젝트"))).toString()
        val given = dir.resolve(nfc("프로젝트")).toString()
        // APFS finds it either way, and an IDE hands a macOS path over as NFC.
        val expected = if (Files.exists(Path.of(given))) onDisk else given

        assertEquals(expected, Authz(env).realpathOrSelf(given))
    }

    @Test
    fun `keeps a missing tail in the normalization it was given, NFC or NFD`() {
        val ws = Files.createDirectory(dir.resolve("ws")).toString()
        val authz = Authz(env)

        for (name in listOf(nfc("새 문서.erd.json"), nfd("새 문서.erd.json"))) {
            assertEquals(ws + separator() + name, authz.resolveRealPath("$ws${separator()}$name"))
        }
    }

    @Test
    fun `lstats a dangling symlink that realpath cannot resolve, and keeps any other failure apart`() {
        val link = Files.createSymbolicLink(dir.resolve("dangling"), dir.resolve("nowhere")).toString()
        val file = Files.writeString(dir.resolve("a.erd.json"), "{}")

        assertEquals(LstatResult.EXISTS, env.lstat(link))
        assertEquals(RealPathResult.NotFound, env.realPath(link))
        assertEquals(LstatResult.NOT_FOUND, env.lstat(dir.resolve("nowhere").toString()))
        // Under a regular file lstat fails with ENOTDIR on POSIX, on JBR 21 and 25 alike, and Windows calls it
        // missing. The climb never gets there: realpath fails with ENOTDIR, and resolves nothing.
        val underFileAnswer = if (platform.isWindows) LstatResult.NOT_FOUND else LstatResult.OTHER
        assertEquals(underFileAnswer, env.lstat(file.resolve("under-a-file").toString()))
        assertEquals(underFileAnswer, env.lstat(file.resolve("under-a-file").resolve("deeper").toString()))
        assertEquals(LstatResult.NOT_FOUND, env.lstat(dir.resolve("nowhere").resolve("deeper").toString()))
        val underFile = file.resolve("under-a-file").resolve("x.erd.json").toString()
        assertEquals(if (platform.isWindows) underFile else null, Authz(env).resolveRealPath(underFile))
        assertEquals(LstatResult.OTHER, env.lstat("$dir/a\u0000"))
    }

    @Test
    fun `finds a missing path under a regular file, through links and missing folders, on POSIX alone`() {
        val file = Files.writeString(dir.resolve("a.erd.json"), "{}")
        val fileLink = Files.createSymbolicLink(dir.resolve("file-link"), file)
        val dirLink = Files.createSymbolicLink(dir.resolve("dir-link"), dir)

        assertTrue(missingUnderAFile(file.resolve("x"), HubPlatform.LINUX))
        assertTrue(missingUnderAFile(file.resolve("x").resolve("y"), HubPlatform.DARWIN))
        assertTrue(missingUnderAFile(fileLink.resolve("x"), HubPlatform.LINUX))
        assertFalse(missingUnderAFile(dirLink.resolve("none").resolve("x"), HubPlatform.LINUX))
        assertFalse(missingUnderAFile(dir.resolve("none").resolve("x"), HubPlatform.LINUX))
        assertFalse(missingUnderAFile(Path.of("no-such-folder-${System.nanoTime()}", "x"), HubPlatform.LINUX))
        assertFalse(missingUnderAFile(file.resolve("x"), HubPlatform.WIN32))
    }

    @Test
    fun `deletes a file before it returns, and never throws for one that is gone or cannot go`() {
        val file = Files.writeString(dir.resolve("a.json"), "{}").toString()

        env.removeFileSync(file)

        assertFalse(Files.exists(Path.of(file)))
        env.removeFileSync(file)
        env.removeFileSync(dir.toString())
        env.removeFileSync("$dir/a\u0000.json")
        assertTrue(Files.isDirectory(dir))
    }

    @Test
    fun `reads text as TextDecoder does, one BOM dropped and malformed bytes replaced`() {
        val bom = byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte())
        val twice = Files.write(dir.resolve("bom.erd.json"), bom + bom + "{}".toByteArray())
        val broken = Files.write(dir.resolve("broken.erd.json"), byteArrayOf('a'.code.toByte(), 0xFF.toByte()))

        assertEquals("\uFEFF{}", NioFileSystem.readText(twice.toString()))
        assertEquals("a\uFFFD", NioFileSystem.readText(broken.toString()))
    }

    @Test
    fun `creates directories and new files, and moves one over another`() {
        val lockDir = dir.resolve("home/.erd-editor/ide")
        NioFileSystem.makeDirectories(lockDir.toString(), LockPaths.LOCK_DIR_MODE)
        NioFileSystem.makeDirectories(lockDir.toString(), LockPaths.LOCK_DIR_MODE)
        val temp = lockDir.resolve("1.json.tmp").toString()
        val lock = lockDir.resolve("1.json").toString()

        NioFileSystem.writeNewFile(temp, "한 {}", LockPaths.LOCK_FILE_MODE)
        assertThrows(FileAlreadyExistsException::class.java) { NioFileSystem.writeNewFile(temp, "", null) }
        assertThrows(NoSuchFileException::class.java) { NioFileSystem.writeNewFile("$dir/none/x", "", null) }
        NioFileSystem.writeNewFile(lock, "old", null)
        NioFileSystem.moveReplacing(temp, lock)

        assertEquals("한 {}", NioFileSystem.readText(lock))
        assertEquals(listOf("1.json"), NioFileSystem.listNames(lockDir.toString()))
        assertEquals(null, NioFileSystem.listNames(dir.resolve("none").toString()))
        assertEquals(Files.getLastModifiedTime(Path.of(lock)).toMillis(), NioFileSystem.mtimeMs(lock))
        NioFileSystem.statExisting(lock)
        assertThrows(NoSuchFileException::class.java) { NioFileSystem.statExisting(temp) }
        assertThrows(NoSuchFileException::class.java) { NioFileSystem.statExisting("$dir/none/x") }
        val underFile = assertThrows(FileSystemException::class.java) { NioFileSystem.statExisting("$lock/x/y") }
        if (platform.isWindows) {
            assertTrue("$underFile", underFile is NoSuchFileException)
        } else {
            assertFalse("$underFile", underFile is NoSuchFileException)
            assertEquals("Not a directory", underFile.reason)
            assertEquals("$lock/x/y", underFile.file)
        }
        NioFileSystem.deleteIfExists(lock)
        NioFileSystem.deleteIfExists(lock)
        assertFalse(Files.exists(Path.of(lock)))
    }

    @Test
    fun `gives the lock directory and file their modes, and leaves an existing directory's alone`() {
        assumeTrue("POSIX modes", posix)
        val home = Files.createDirectory(dir.resolve("home"), PosixFilePermissions.asFileAttribute(mode("rwxr-xr-x")))
        val lockDir = home.resolve(".erd-editor/ide")

        NioFileSystem.makeDirectories(lockDir.toString(), LockPaths.LOCK_DIR_MODE)
        NioFileSystem.writeNewFile(lockDir.resolve("1.json").toString(), "{}", LockPaths.LOCK_FILE_MODE)

        assertEquals(mode("rwx------"), Files.getPosixFilePermissions(lockDir))
        assertEquals(mode("rwx------"), Files.getPosixFilePermissions(home.resolve(".erd-editor")))
        assertEquals(mode("rwxr-xr-x"), Files.getPosixFilePermissions(home))
        assertEquals(mode("rw-------"), Files.getPosixFilePermissions(lockDir.resolve("1.json")))
    }

    @Test
    fun `creates a document only where none is, under an existing folder`() {
        val path = dir.resolve("new.erd.json").toString()

        NioFileSystem.createExclusive(path, "{\"version\":\"3.0.0\"}")

        assertEquals("{\"version\":\"3.0.0\"}", NioFileSystem.readText(path))
        assertThrows(FileAlreadyExistsException::class.java) { NioFileSystem.createExclusive(path, "{}") }
        assertThrows(NoSuchFileException::class.java) { NioFileSystem.createExclusive("$dir/none/b.erd.json", "{}") }
    }

    @Test
    fun `spells a mode as its permission bits`() {
        assertEquals(mode("rwx------"), posixPermissions(LockPaths.LOCK_DIR_MODE))
        assertEquals(mode("rw-------"), posixPermissions(LockPaths.LOCK_FILE_MODE))
        assertEquals(mode("rwxr-x--x"), posixPermissions(0x1E9))
        assertEquals(emptySet<Any>(), posixPermissions(0))
    }

    @Test
    fun `measures time on a clock that never goes back`() {
        val first = HubClock.monotonic.nowMs()

        assertTrue(HubClock.monotonic.nowMs() >= first)
    }

    private fun exitedPid(): Long {
        val command = if (platform.isWindows) listOf("cmd.exe", "/c", "exit") else listOf("true")
        val process = ProcessBuilder(command).start()
        assertTrue(process.waitFor(10, TimeUnit.SECONDS))
        return process.pid()
    }

    private fun separator(): String = if (platform.isWindows) "\\" else "/"

    private fun mode(text: String) = PosixFilePermissions.fromString(text)

    private fun nfc(text: String) = Normalizer.normalize(text, Normalizer.Form.NFC)

    private fun nfd(text: String) = Normalizer.normalize(text, Normalizer.Form.NFD)

    private companion object {
        val UUID_V4 = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
    }
}
