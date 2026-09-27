package com.github.dineug.erdeditorintellijplugin.hub

/**
 * Where a hub's lock and pipe live, built by string concatenation as packages/agent-hub's lock.ts
 * and agent-hub-host's pipePath.ts build them, so a Windows home gets mixed separators: the MCP
 * server computes the same strings and must find the same files.
 */
object LockPaths {
    /**
     * The longest socket path handed out, in UTF-8 bytes, under the sun_path field of 104 bytes on
     * macOS and 108 on Linux; a longer one binds under the temp directory instead.
     */
    const val MAX_PIPE_PATH_BYTES: Int = 100

    /** 0o700, given to each lock directory the hub creates; an existing one keeps its mode. */
    const val LOCK_DIR_MODE: Int = 448

    /** 0o600: a lock names the token that admits a peer, so only its user may read it. */
    const val LOCK_FILE_MODE: Int = 384

    private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L
    private val LOCK_FILE_NAME = Regex("^([1-9][0-9]*)\\.json$")

    /** Strip trailing / and \, + "/.erd-editor/ide". */
    fun lockDirPath(home: String): String = "${stripSeparators(home)}/.erd-editor/ide"

    fun lockFilePath(home: String, pid: Long): String = "${lockDirPath(home)}/$pid.json"

    fun lockTempPath(home: String, pid: Long): String = "${lockFilePath(home, pid)}.tmp"

    /** A named pipe on win32, a unix socket beside the lock file elsewhere. */
    fun pipePath(home: String, pid: Long, platform: HubPlatform): String =
        if (platform.isWindows) "\\\\.\\pipe\\erd-editor-ide-$pid" else "${lockDirPath(home)}/$pid.sock"

    /** The socket a hub binds under the temp directory when its home is too long. */
    fun tmpPipePath(tmp: String, pid: Long): String = "${stripSeparators(tmp)}/erd-editor-ide-$pid.sock"

    /** Whether a listener can bind this path; named pipes are not bound by the socket limit. */
    fun pipePathFits(pipe: String, platform: HubPlatform): Boolean =
        platform.isWindows || pipe.toByteArray(Charsets.UTF_8).size <= MAX_PIPE_PATH_BYTES

    /** Beside the lock file, or under tmp when that path does not fit; null when neither fits. */
    fun choosePipePath(home: String, tmp: String, pid: Long, platform: HubPlatform): String? {
        val preferred = pipePath(home, pid, platform)
        if (pipePathFits(preferred, platform)) return preferred
        return tmpPipePath(tmp, pid).takeIf { pipePathFits(it, platform) }
    }

    /** Every socket file a hub with this pid can have bound; a named pipe is no file. */
    fun socketFilePaths(home: String, tmp: String, pid: Long, platform: HubPlatform): List<String> =
        if (platform.isWindows) emptyList() else listOf(pipePath(home, pid, platform), tmpPipePath(tmp, pid))

    /** The pid a lock file name encodes (^([1-9]\d*)\.json$, a safe integer), or null for any other file. */
    fun lockFilePid(fileName: String): Long? {
        val digits = LOCK_FILE_NAME.matchEntire(fileName)?.groupValues?.get(1) ?: return null
        return digits.toLongOrNull()?.takeIf { it <= MAX_SAFE_INTEGER }
    }

    private fun stripSeparators(path: String): String = path.trimEnd('/', '\\')
}
