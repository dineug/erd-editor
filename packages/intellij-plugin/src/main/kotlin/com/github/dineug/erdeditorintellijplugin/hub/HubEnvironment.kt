package com.github.dineug.erdeditorintellijplugin.hub

/** What a native realpath answered: the path as the disk spells it, no entry at all, or any other failure. */
sealed interface RealPathResult {
    data class Ok(val path: String) : RealPathResult

    data object NotFound : RealPathResult

    /** Permission, not a directory, a loop, a string no file system takes: authorization climbs no further. */
    data class Other(val cause: Throwable) : RealPathResult
}

/** lstat without following the last link: a dangling symlink is still an entry. */
enum class LstatResult { EXISTS, NOT_FOUND, OTHER }

/** Milliseconds that only ever grow, for the join window's quiet timing; tests set them by hand. */
fun interface HubClock {
    fun nowMs(): Double

    companion object {
        val monotonic: HubClock = HubClock { System.nanoTime() / NANOS_PER_MILLI }

        private const val NANOS_PER_MILLI = 1_000_000.0
    }
}

/** Every file operation the hub performs, so tests can fail or hold one. Throws on failure. */
interface HubFileSystem {
    /** mkdir -p; posixMode applies to the directories this call creates, never to an existing one. */
    fun makeDirectories(dir: String, posixMode: Int?)

    fun deleteIfExists(path: String)

    /** Creates path, failing when it exists (CREATE_NEW), with posixMode where the file system has modes. */
    fun writeNewFile(path: String, text: String, posixMode: Int?)

    /** An atomic rename over whatever is at to; a rename keeps the source's mode. */
    fun moveReplacing(from: String, to: String)

    /** The names in dir, in listing order; null when it is missing or cannot be read. */
    fun listNames(dir: String): List<String>?

    /** UTF-8 with malformed bytes replaced, one leading U+FEFF dropped as TextDecoder drops it. */
    fun readText(path: String): String

    fun mtimeMs(path: String): Long

    /** Follows links; NoSuchFileException when nothing is there, any other IOException as it comes. */
    fun statExisting(path: String)

    /** openDocument's create: FileAlreadyExistsException when path exists, NoSuchFileException without its parent. */
    fun createExclusive(path: String, text: String)
}

/** The machine the hub runs on, read once when the hub is built; MachineEnvironment in production. */
interface HubEnvironment {
    /** Node's os.homedir(), which the MCP server reads the lock directory under. */
    val homeDir: String

    /** Node's os.tmpdir(), where a socket goes when the home is too long for one. */
    val tmpDir: String
    val platform: HubPlatform
    val pid: Long

    /** The plugin version the lock and every hello answer carry. */
    val version: String
    val fs: HubFileSystem
    val clock: HubClock

    /** A fresh token per listen: UUID.randomUUID().toString(). */
    fun randomToken(): String

    /** Whether a process with this pid runs, as Node's process.kill(pid, 0) answers it. */
    fun isAlive(pid: Long): Boolean

    /**
     * POSIX: toRealPath; WIN32: WindowsRealPath (libuv's GetFinalPathNameByHandleW), which also
     * resolves a subst or mapped drive, then toRealPath when it finds no real path. A string no path
     * takes, and any failure but a missing entry, answers Other.
     */
    fun realPath(path: String): RealPathResult

    /** NOFOLLOW_LINKS; NoSuchFileException → NOT_FOUND; else OTHER. */
    fun lstat(path: String): LstatResult

    /** Deletes a file before it returns, for a process going down; never throws, leaves a directory alone. */
    fun removeFileSync(path: String)
}
