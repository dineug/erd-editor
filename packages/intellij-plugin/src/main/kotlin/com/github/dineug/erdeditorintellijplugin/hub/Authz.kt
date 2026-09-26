package com.github.dineug.erdeditorintellijplugin.hub

/** What the lock advertises: HubPaths compares a peer's real path against it, both sides realpathed. */
data class AuthScope(val folders: List<String>, val documents: List<String>) {
    companion object {
        val EMPTY: AuthScope = AuthScope(emptyList(), emptyList())
    }
}

/**
 * Path authorization over the machine's native realpath, as packages/agent-hub-host's authz.ts:
 * a peer's path counts under its real spelling, so a symlink never leads a write out of the
 * workspace. Nothing here throws on a bad path; it answers null or the outsideWorkspace refusal.
 */
class Authz(private val env: HubEnvironment) {
    /**
     * Resolves symlinks on the longest existing prefix, so a document about to be created still
     * resolves, or null when no safe real path exists. A relative path comes back as given, and
     * HubPaths then matches it against nothing.
     */
    fun resolveRealPath(target: String): String? {
        if (!NodePath.isAbsolute(target, env.platform)) return target
        var current = target
        val tail = ArrayDeque<String>()
        while (true) {
            when (val resolved = realPathOf(current)) {
                // A missing directory followed by .. names nothing; joining would fold the pair away.
                is RealPathResult.Ok ->
                    return if (".." in tail) null else NodePath.joinReal(resolved.path, tail, env.platform)
                is RealPathResult.Other -> return null
                RealPathResult.NotFound -> {}
            }
            // Climbs only past an entry that is not there at all: a dangling link is one, and a write follows it.
            val parent = NodeDirs.dirname(current, env.platform)
            if (parent == current || lstatOf(current) != LstatResult.NOT_FOUND) return null
            tail.addFirst(NodeDirs.basename(current, env.platform))
            current = parent
        }
    }

    /** The native realpath, or the path unchanged on any failure: how the lock lists folders and documents. */
    fun realpathOrSelf(path: String): String = (realPathOf(path) as? RealPathResult.Ok)?.path ?: path

    /** Returns the real path, or throws HubRequestError(OUTSIDE_WORKSPACE, noRealPath/outsideWorkspace). */
    fun authorizePath(scope: AuthScope, target: String): String {
        val real = resolveRealPath(target)
            ?: throw HubRequestError(HubErrorCode.OUTSIDE_WORKSPACE, HubTexts.noRealPath(target))
        HubPaths.authorize(scope.folders, scope.documents, real, env.platform)
        return real
    }

    private fun realPathOf(path: String): RealPathResult = try {
        env.realPath(path)
    } catch (e: Exception) {
        e.rethrowIfCancellation()
        RealPathResult.Other(e)
    }

    private fun lstatOf(path: String): LstatResult = try {
        env.lstat(path)
    } catch (e: Exception) {
        e.rethrowIfCancellation()
        LstatResult.OTHER
    }
}

/**
 * node:path's dirname and basename, posix or win32 by the hub's platform, on strings: the climb
 * must split a peer's path as the Node hosts do whatever the JVM's own path rules are, and a
 * Windows path must split the same on a Linux CI host. Neither normalizes, so ".." stays a name.
 */
internal object NodeDirs {
    fun dirname(path: String, platform: HubPlatform): String =
        if (platform.isWindows) win32Dirname(path) else posixDirname(path)

    /** The last name, trailing separators ignored; after a drive's colon on win32. */
    fun basename(path: String, platform: HubPlatform): String {
        val windows = platform.isWindows
        var start = if (windows && path.length >= 2 && isDriveLetter(path[0]) && path[1] == ':') 2 else 0
        var end = -1
        for (index in path.length - 1 downTo start) {
            if (isSeparator(path[index], windows)) {
                if (end != -1) {
                    start = index + 1
                    break
                }
            } else if (end == -1) {
                end = index + 1
            }
        }
        return if (end == -1) "" else path.substring(start, end)
    }

    private fun posixDirname(path: String): String {
        if (path.isEmpty()) return "."
        val hasRoot = path[0] == '/'
        val end = lastSeparatorBeforeName(path, 1, windows = false)
        return when {
            end == -1 -> if (hasRoot) "/" else "."
            hasRoot && end == 1 -> "//"
            else -> path.substring(0, end)
        }
    }

    private fun win32Dirname(path: String): String {
        val length = path.length
        if (length == 0) return "."
        if (length == 1) return if (isSeparator(path[0], windows = true)) path else "."
        var rootEnd = -1
        var offset = 0
        if (isSeparator(path[0], windows = true)) {
            rootEnd = 1
            offset = 1
            val uncRoot = uncRootEnd(path)
            if (uncRoot == length) return path
            if (uncRoot != -1) {
                rootEnd = uncRoot + 1
                offset = uncRoot + 1
            }
        } else if (isDriveLetter(path[0]) && path[1] == ':') {
            rootEnd = if (length > 2 && isSeparator(path[2], windows = true)) 3 else 2
            offset = rootEnd
        }
        val end = lastSeparatorBeforeName(path, offset, windows = true)
        if (end != -1) return path.substring(0, end)
        return if (rootEnd == -1) "." else path.substring(0, rootEnd)
    }

    /**
     * Where "\\server\share" ends in a path that opens with two separators: the index after the
     * share's name, the length for a bare root; -1 when it names no share, which leaves "\" the root.
     */
    private fun uncRootEnd(path: String): Int {
        if (!isSeparator(path[1], windows = true)) return -1
        val server = skip(path, 2, separators = false)
        if (server == path.length || server == 2) return -1
        val share = skip(path, server, separators = true)
        if (share == path.length) return -1
        return skip(path, share, separators = false)
    }

    /** The index past a run of separators, or of non-separators, from index on. */
    private fun skip(path: String, from: Int, separators: Boolean): Int {
        var index = from
        while (index < path.length && isSeparator(path[index], windows = true) == separators) index++
        return index
    }

    /** The separator before the last name at or after offset, trailing separators skipped; -1 without one. */
    private fun lastSeparatorBeforeName(path: String, offset: Int, windows: Boolean): Int {
        var seenName = false
        for (index in path.length - 1 downTo offset) {
            if (isSeparator(path[index], windows)) {
                if (seenName) return index
            } else {
                seenName = true
            }
        }
        return -1
    }

    private fun isSeparator(char: Char, windows: Boolean): Boolean = char == '/' || (windows && char == '\\')

    private fun isDriveLetter(char: Char): Boolean = char in 'a'..'z' || char in 'A'..'Z'
}
