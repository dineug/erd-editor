package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.win.WindowsRealPath
import com.sun.jna.NativeLibrary
import com.sun.jna.Platform
import java.nio.ByteBuffer
import java.nio.file.FileSystemException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.nio.file.attribute.BasicFileAttributes
import java.nio.file.attribute.FileAttribute
import java.nio.file.attribute.PosixFilePermission
import java.nio.file.attribute.PosixFilePermissions
import java.util.EnumSet
import java.util.Properties
import java.util.TreeMap
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/** java.nio.file over the default file system; modes apply only where it has POSIX permissions. */
object NioFileSystem : HubFileSystem {
    override fun makeDirectories(dir: String, posixMode: Int?) {
        val path = Path.of(dir)
        Files.createDirectories(path, *modeAttribute(path, posixMode))
    }

    override fun deleteIfExists(path: String) {
        Files.deleteIfExists(Path.of(path))
    }

    override fun writeNewFile(path: String, text: String, posixMode: Int?) {
        val file = Path.of(path)
        val options = EnumSet.of(StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
        Files.newByteChannel(file, options, *modeAttribute(file, posixMode)).use { channel ->
            val bytes = ByteBuffer.wrap(text.toByteArray(Charsets.UTF_8))
            while (bytes.hasRemaining()) channel.write(bytes)
        }
    }

    override fun moveReplacing(from: String, to: String) {
        Files.move(Path.of(from), Path.of(to), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
    }

    override fun listNames(dir: String): List<String>? = try {
        Files.newDirectoryStream(Path.of(dir)).use { entries -> entries.map { it.fileName.toString() } }
    } catch (e: Exception) {
        e.rethrowIfCancellation()
        null
    }

    override fun readText(path: String): String =
        String(Files.readAllBytes(Path.of(path)), Charsets.UTF_8).removePrefix(BOM)

    override fun mtimeMs(path: String): Long = Files.getLastModifiedTime(Path.of(path)).toMillis()

    override fun statExisting(path: String) {
        val file = Path.of(path)
        try {
            Files.readAttributes(file, BasicFileAttributes::class.java)
        } catch (e: NoSuchFileException) {
            if (missingUnderAFile(file, host)) throw FileSystemException(path, null, NOT_A_DIRECTORY)
            throw e
        }
    }

    override fun createExclusive(path: String, text: String) {
        val options = EnumSet.of(StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
        Files.newByteChannel(Path.of(path), options).use { channel ->
            val bytes = ByteBuffer.wrap(text.toByteArray(Charsets.UTF_8))
            while (bytes.hasRemaining()) channel.write(bytes)
        }
    }

    /** The mode as a creation attribute, masked by the umask as Node's is; none on a file system without modes. */
    private fun modeAttribute(path: Path, posixMode: Int?): Array<FileAttribute<*>> {
        if (posixMode == null || "posix" !in path.fileSystem.supportedFileAttributeViews()) return emptyArray()
        return arrayOf(PosixFilePermissions.asFileAttribute(posixPermissions(posixMode)))
    }

    private const val BOM = "\uFEFF"
    private const val NOT_A_DIRECTORY = "Not a directory"
    private val host = HubPlatform.current()
}

/**
 * Whether a path the JDK found missing lies under a regular file, which is ENOTDIR to Node's stat
 * and lstat: JBR 21 reports that as such and JBR 25 as a missing entry. Windows itself answers such
 * a path as missing (ERROR_PATH_NOT_FOUND), and so does libuv there, so it is never asked.
 */
internal fun missingUnderAFile(path: Path, platform: HubPlatform): Boolean {
    if (platform.isWindows) return false
    // The kernel follows every component but the last on the way down, and so do exists and isDirectory.
    var ancestor = path.parent
    while (ancestor != null && !Files.exists(ancestor)) ancestor = ancestor.parent
    return ancestor != null && !Files.isDirectory(ancestor)
}

/** The permission bits of a mode such as 0o600, in PosixFilePermission's order from 0o400 down to 0o001. */
internal fun posixPermissions(mode: Int): Set<PosixFilePermission> =
    PosixFilePermission.entries.filterTo(EnumSet.noneOf(PosixFilePermission::class.java)) { permission ->
        mode and (1 shl (PosixFilePermission.entries.size - 1 - permission.ordinal)) != 0
    }

/**
 * This machine as Node sees it, so the lock lands where the MCP server looks and names the pid
 * it probes. [log] receives the one line of a liveness fallback; the rest of the hub logs itself.
 */
class MachineEnvironment(
    override val homeDir: String,
    override val tmpDir: String,
    override val platform: HubPlatform,
    override val pid: Long,
    override val version: String,
    override val fs: HubFileSystem = NioFileSystem,
    override val clock: HubClock = HubClock.monotonic,
    private val log: HubLog? = null,
) : HubEnvironment {
    /** The POSIX liveness primitive, libc's kill(pid, 0); a test swaps in one that fails. */
    internal var posixSignal0: (Int) -> Int = ::sendSignal0

    /** The native realpath on Windows, WindowsRealPath's; a test swaps in one that finds nothing. */
    internal var windowsRealPath: (String) -> RealPathResult = WindowsRealPath::realPath

    override fun randomToken(): String = UUID.randomUUID().toString()

    override fun isAlive(pid: Long): Boolean = isAlive(pid, platform, posixSignal0, log)

    override fun realPath(path: String): RealPathResult {
        // Node's realpath finds no entry named "", where Path.of("") would stand for the working directory.
        if (path.isEmpty()) return RealPathResult.NotFound
        if (!platform.isWindows) return jdkRealPath(path)
        val native = windowsRealPath(path)
        if (native is RealPathResult.Ok) return native
        // Node's hosts go on to the JS realpath the same way for a volume with no final path, where a
        // subst letter stays; a path over MAX_PATH Node namespaces and resolves natively, and the JDK here
        // (AGENTS.md). What libuv found missing and the JDK refuses, a "?" in a name or an entry under a
        // file, stays missing, as the JS realpath's lstat finds it.
        val jdk = jdkRealPath(path)
        return if (native == RealPathResult.NotFound && jdk is RealPathResult.Other) native else jdk
    }

    /** toRealPath: NoSuchFileException is NotFound, and any other failure, a string no path takes too, Other. */
    private fun jdkRealPath(path: String): RealPathResult = try {
        RealPathResult.Ok(Path.of(path).toRealPath().toString())
    } catch (e: NoSuchFileException) {
        RealPathResult.NotFound
    } catch (e: Exception) {
        e.rethrowIfCancellation()
        RealPathResult.Other(e)
    }

    override fun lstat(path: String): LstatResult = try {
        Files.readAttributes(Path.of(path), BasicFileAttributes::class.java, LinkOption.NOFOLLOW_LINKS)
        LstatResult.EXISTS
    } catch (e: NoSuchFileException) {
        if (missingUnderAFile(Path.of(path), platform)) LstatResult.OTHER else LstatResult.NOT_FOUND
    } catch (e: Exception) {
        e.rethrowIfCancellation()
        LstatResult.OTHER
    }

    override fun removeFileSync(path: String) {
        try {
            val file = Path.of(path)
            if (!Files.isDirectory(file, LinkOption.NOFOLLOW_LINKS)) Files.deleteIfExists(file)
        } catch (e: Exception) {
            // Missing, or out of reach: nothing is left to do while the process goes down.
            e.rethrowIfCancellation()
        }
    }

    companion object {
        /** Whether the libc binding failed in this JVM, so liveness asks ProcessHandle from then on. */
        private val primitiveFailed = AtomicBoolean(false)

        /** Production only: the one place the hub reads the real home, temp directory and pid. */
        fun forMachine(
            version: String,
            env: Map<String, String> = System.getenv(),
            props: Properties = System.getProperties(),
            platform: HubPlatform = HubPlatform.current(),
            log: HubLog? = null,
        ): MachineEnvironment = MachineEnvironment(
            homeDir = nodeHomeDir(platform, env, props.getProperty("user.home").orEmpty()),
            tmpDir = nodeTmpDir(platform, env, props.getProperty("java.io.tmpdir").orEmpty()),
            platform = platform,
            pid = ProcessHandle.current().pid(),
            version = version,
            log = log,
        )

        /**
         * Node's os.homedir(): HOME whenever it is set, even empty, on POSIX; USERPROFILE on Windows;
         * else the account's home, which is what the JVM's user.home holds.
         */
        fun nodeHomeDir(platform: HubPlatform, env: Map<String, String>, userHome: String): String =
            nodeEnv(platform, env)[if (platform.isWindows) "USERPROFILE" else "HOME"] ?: userHome

        /**
         * Node's os.tmpdir(). POSIX: the first non-empty TMPDIR, TMP, TEMP with one trailing slash
         * dropped, else /tmp. Windows: TEMP, TMP, else SystemRoot or windir plus \temp, one trailing
         * backslash dropped unless it follows a drive; javaTmp stands in where Node would say "undefined".
         */
        fun nodeTmpDir(platform: HubPlatform, env: Map<String, String>, javaTmp: String): String {
            val variables = nodeEnv(platform, env)
            fun first(vararg keys: String): String? = keys.firstNotNullOfOrNull { variables[it]?.ifEmpty { null } }
            if (!platform.isWindows) {
                val dir = first("TMPDIR", "TMP", "TEMP") ?: return "/tmp"
                return if (dir.length > 1 && dir.endsWith('/')) dir.dropLast(1) else dir
            }
            val dir = first("TEMP", "TMP") ?: first("SystemRoot", "windir")?.let { "$it\\temp" } ?: javaTmp
            return if (dir.length > 1 && dir.endsWith('\\') && !dir.endsWith(":\\")) dir.dropLast(1) else dir
        }

        /**
         * Node's process.kill(pid, 0) rule: a pid outside 1..Int.MAX_VALUE is dead without asking. On
         * POSIX the signal answers, where a refusal is dead too, until the primitive fails with anything
         * but IllegalArgumentException; then this JVM asks ProcessHandle, as Windows always does.
         */
        fun isAlive(
            pid: Long,
            platform: HubPlatform,
            posixSignal0: (Int) -> Int = ::sendSignal0,
            log: HubLog? = null,
        ): Boolean {
            if (pid < 1 || pid > Int.MAX_VALUE) return false
            if (platform.isWindows || primitiveFailed.get()) return processAlive(pid)
            return try {
                posixSignal0(pid.toInt()) == 0
            } catch (e: IllegalArgumentException) {
                false
            } catch (e: Throwable) {
                e.rethrowIfCancellation()
                if (primitiveFailed.compareAndSet(false, true)) log?.warn("liveness falls back to ProcessHandle: $e")
                processAlive(pid)
            }
        }

        /** Obsidian's pidSandbox: a Flatpak on Linux has pids of its own, which name no process outside it. */
        fun pidSandbox(platform: HubPlatform, env: Map<String, String>, flatpakInfoExists: Boolean): Boolean =
            platform == HubPlatform.LINUX && (!env["FLATPAK_ID"].isNullOrEmpty() || flatpakInfoExists)

        /** Whether the POSIX primitive failed in this JVM; a test that made it fail resets it. */
        internal var livenessFellBack: Boolean
            get() = primitiveFailed.get()
            set(value) = primitiveFailed.set(value)

        /**
         * The variables as Node looks them up: in any case on Windows, as process.env and libuv's
         * uv_os_getenv do there, where System.getenv()'s map matches the case exactly.
         */
        private fun nodeEnv(platform: HubPlatform, env: Map<String, String>): Map<String, String> {
            if (!platform.isWindows) return env
            return TreeMap<String, String>(String.CASE_INSENSITIVE_ORDER).apply { putAll(env) }
        }

        private fun processAlive(pid: Long): Boolean = ProcessHandle.of(pid).map { it.isAlive }.orElse(false)
    }
}

/**
 * libc's kill as a JNA Function. UnixProcessManager, which wraps the same call, is internal API from
 * 263, and a Library interface of the plugin's own would stay in JNA's static option maps, keeping
 * the plugin's class loader after a dynamic unload; a Function registers nothing there.
 */
private val kill by lazy { NativeLibrary.getInstance(Platform.C_LIBRARY_NAME).getFunction("kill") }

/** kill(pid, 0), Node's own check: 0 when the process exists and may be signalled, -1 otherwise. */
private fun sendSignal0(pid: Int): Int = kill.invokeInt(arrayOf<Any>(pid, 0))
