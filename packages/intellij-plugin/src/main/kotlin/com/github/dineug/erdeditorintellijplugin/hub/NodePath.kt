package com.github.dineug.erdeditorintellijplugin.hub

/**
 * The string-level pieces of node:path the realpath climb needs. Never through Path.of, which
 * throws on a string node:path takes as it is, such as one holding NUL.
 */
object NodePath {
    /** posix: starts with "/"; win32: "C:\", "C:/", "\\server\…", rootless "\x" or "/x" → true; "C:x" → false. */
    fun isAbsolute(path: String, platform: HubPlatform): Boolean {
        if (!platform.isWindows) return path.startsWith('/')
        if (path.isEmpty()) return false
        if (isSeparator(path[0], platform)) return true
        return path.length > 2 && isDriveLetter(path[0]) && path[1] == ':' && isSeparator(path[2], platform)
    }

    /**
     * realPrefix + tail without "" and "." pieces, joined with the platform separator, never
     * doubling it after "/" or "C:\"; code points kept as given, since the JVM normalizes none and
     * neither may the hub.
     */
    fun joinReal(realPrefix: String, tail: List<String>, platform: HubPlatform): String {
        val separator = if (platform.isWindows) '\\' else '/'
        val joined = StringBuilder(realPrefix)
        for (piece in tail) {
            if (piece.isEmpty() || piece == ".") continue
            if (joined.isNotEmpty() && !isSeparator(joined.last(), platform)) joined.append(separator)
            joined.append(piece)
        }
        return joined.toString()
    }

    private fun isSeparator(char: Char, platform: HubPlatform): Boolean =
        char == '/' || (platform.isWindows && char == '\\')

    private fun isDriveLetter(char: Char): Boolean = char in 'a'..'z' || char in 'A'..'Z'
}
