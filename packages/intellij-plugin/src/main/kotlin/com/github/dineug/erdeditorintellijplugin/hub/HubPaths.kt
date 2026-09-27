package com.github.dineug.erdeditorintellijplugin.hub

import java.util.regex.Pattern

/** A Node process.platform, as the peer names its own and the corpus spells it. */
enum class HubPlatform(val node: String) {
    WIN32("win32"),
    DARWIN("darwin"),
    LINUX("linux"),
    OTHER("other");

    /** win32 and darwin compare paths case-insensitively. */
    val foldsCase: Boolean get() = this == WIN32 || this == DARWIN

    val isWindows: Boolean get() = this == WIN32

    companion object {
        fun of(node: String): HubPlatform = entries.firstOrNull { it.node == node } ?: OTHER

        fun current(osName: String = System.getProperty("os.name")): HubPlatform {
            val name = osName.lowercase()
            return when {
                name.startsWith("windows") -> WIN32
                name.startsWith("mac") || name.startsWith("darwin") -> DARWIN
                name.startsWith("linux") -> LINUX
                else -> OTHER
            }
        }
    }
}

/**
 * The path rules of packages/agent-hub's paths.ts. Paths are compared as strings, never resolved:
 * the caller realpaths both sides. Segments fold case per segment through lowercase(), which is
 * locale-independent as JavaScript's toLowerCase is, with no Unicode normalization.
 */
object HubPaths {
    /**
     * Splits a path whose first segment is its root: a slash, or on win32 a lowercased drive or a
     * double slash for a share, backslashes folded first. Empty and dot segments drop, ".." stays;
     * a relative path has no root segment.
     */
    fun toSegments(path: String, platform: HubPlatform): List<String> {
        if (path.isEmpty()) return emptyList()

        val slashed = if (platform.isWindows) path.replace('\\', '/') else path
        // Kotlin's split keeps every empty piece, as JavaScript's does; Java's split(regex) drops them.
        val pieces = slashed.split('/')
        val head = pieces[0]
        val root = when {
            head.isNotEmpty() -> if (platform.isWindows && isDrive(head)) head.lowercase() else head
            platform.isWindows && slashed.startsWith("//") -> "//"
            else -> "/"
        }
        return listOf(root) + pieces.drop(1).filter { it.isNotEmpty() && it != "." }
    }

    /** A folder counts as inside itself; a relative path or one with .. is never inside. */
    fun isInside(parent: String, child: String, platform: HubPlatform): Boolean {
        val parentSegments = comparable(parent, platform) ?: return false
        val childSegments = comparable(child, platform) ?: return false
        return startsWith(childSegments, parentSegments)
    }

    fun isSamePath(a: String, b: String, platform: HubPlatform): Boolean {
        val aSegments = comparable(a, platform) ?: return false
        val bSegments = comparable(b, platform) ?: return false
        return aSegments == bSegments
    }

    /** The index of the deepest folder containing target, the first on a tie, or -1. */
    fun longestPrefixIndex(folders: List<String>, target: String, platform: HubPlatform): Int {
        var best = -1
        var bestDepth = -1
        folders.forEachIndexed { index, folder ->
            val depth = toSegments(folder, platform).size
            if (depth > bestDepth && isInside(folder, target, platform)) {
                best = index
                bestDepth = depth
            }
        }
        return best
    }

    /** Inside a workspace folder, or exactly one of the open documents. */
    fun isAuthorized(folders: List<String>, documents: List<String>, target: String, platform: HubPlatform): Boolean =
        documents.any { isSamePath(it, target, platform) } || folders.any { isInside(it, target, platform) }

    /** Throws HubRequestError(OUTSIDE_WORKSPACE, HubTexts.outsideWorkspace(target)). */
    fun authorize(folders: List<String>, documents: List<String>, target: String, platform: HubPlatform) {
        if (!isAuthorized(folders, documents, target, platform)) {
            throw HubRequestError(HubErrorCode.OUTSIDE_WORKSPACE, HubTexts.outsideWorkspace(target))
        }
    }

    /**
     * On win32, the first name in path that Windows does not store as written: one holding a colon
     * or another refused character, ending in a dot or space, or a device such as NUL.erd. Null
     * elsewhere; ".." and a "\\?\" prefix with its drive are no names.
     */
    fun unsafeSegment(path: String, platform: HubPlatform): String? {
        if (!platform.isWindows) return null
        val segments = toSegments(path, platform)
        var names = if (segments.isNotEmpty() && isRoot(segments[0], platform)) segments.drop(1) else segments
        if (segments.firstOrNull() == "//") {
            if (names.firstOrNull() == "?") names = names.drop(1)
            if (names.isNotEmpty() && isDrive(names[0])) names = names.drop(1)
        }
        return names.firstOrNull { it != ".." && isUnsafeName(it) }
    }

    /** Segments ready for comparison, or null for a path that must match nothing. */
    private fun comparable(path: String, platform: HubPlatform): List<String>? {
        val segments = toSegments(path, platform)
        if (segments.isEmpty() || !isRoot(segments[0], platform) || ".." in segments) return null
        return if (platform.foldsCase) segments.map { it.lowercase() } else segments
    }

    private fun isRoot(segment: String, platform: HubPlatform): Boolean =
        segment == "/" || (platform.isWindows && (segment == "//" || isDrive(segment)))

    // JavaScript's /^[a-z]:$/i: ASCII letters only, since the flag folds no other letter onto them.
    private fun isDrive(segment: String): Boolean =
        segment.length == 2 && segment[1] == ':' && (segment[0] in 'a'..'z' || segment[0] in 'A'..'Z')

    private fun startsWith(child: List<String>, parent: List<String>): Boolean =
        child.size >= parent.size && parent.indices.all { parent[it] == child[it] }

    /** What Win32 refuses in a name, beside every character below U+0020. */
    private const val REFUSED_CHARACTERS = "<>:\"|?*"

    // A device name. CASE_INSENSITIVE alone folds ASCII letters only, as JavaScript's i flag
    // without u does, where Kotlin's RegexOption.IGNORE_CASE would add UNICODE_CASE.
    private val DEVICE: Pattern = Pattern.compile(
        "(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])",
        Pattern.CASE_INSENSITIVE,
    )

    // The stem before the first dot loses trailing spaces only, as paths.ts's replace does, never
    // trim(), which would also take a tab or U+00A0 off the end.
    private fun isUnsafeName(name: String): Boolean =
        name.any { it < ' ' || it in REFUSED_CHARACTERS } || name.endsWith('.') || name.endsWith(' ') ||
            DEVICE.matcher(name.substringBefore('.').trimEnd(' ')).matches()
}
