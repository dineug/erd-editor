package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import com.github.dineug.erdeditorintellijplugin.hub.testing.CorpusRefusal
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeOp
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path

/**
 * The realpath climb and path authorization: the host corpus's vectors, each over a machine of its
 * own, the file system calls the climb makes over FakeEnvironment, and the symlink escapes over the
 * real file system under a temp dir.
 */
class AuthzTest {
    private val temps = ArrayList<Path>()

    @After
    fun tearDown() {
        temps.forEach { it.toFile().deleteRecursively() }
    }

    @Test
    fun `resolves every corpus path as the TypeScript hub does`() {
        for (vector in Corpus.host.authz.resolve) {
            val machine = CorpusMachine(vector.platform, vector.links, vector.existing, vector.failing)

            val real = Authz(machine).resolveRealPath(vector.target)

            assertEquals("${vector.target} on ${vector.platform}", vector.real, real)
        }
    }

    @Test
    fun `authorizes every corpus path as the TypeScript hub does`() {
        for (vector in Corpus.host.authz.authorize) {
            val machine = CorpusMachine(vector.platform, vector.links, vector.existing, vector.failing)
            val scope = AuthScope(vector.folders, vector.documents)
            val outcome = try {
                Authz(machine).authorizePath(scope, vector.target) to null
            } catch (e: HubRequestError) {
                null to CorpusRefusal(e.code.wire, e.message.orEmpty())
            }

            assertEquals("${vector.target} on ${vector.platform}", vector.real to vector.error, outcome)
        }
    }

    @Test
    fun `refuses on win32 a name Windows does not store as written before it opens anything`() {
        for ((target, segment) in listOf("C:\\ws\\COM1.erd" to "COM1.erd", "C:\\ws\\a:b.erd" to "a:b.erd")) {
            val machine = CorpusMachine(HubPlatform.WIN32, emptyMap(), listOf(target), emptyList())
            val scope = AuthScope(listOf("C:\\ws"), emptyList())

            val refusal = assertThrows(target, HubRequestError::class.java) {
                Authz(machine).authorizePath(scope, target)
            }

            assertEquals(HubErrorCode.BAD_REQUEST, refusal.code)
            assertEquals(HubTexts.unsafeName(target, segment), refusal.message)
            assertEquals(emptyList<String>(), machine.realPathCalls + machine.lstatCalls)
        }
    }

    @Test
    fun `asks the file system nothing about a relative path`() {
        val env = FakeEnvironment()

        assertEquals("ws/a.erd.json", Authz(env).resolveRealPath("ws/a.erd.json"))
        assertEquals(emptyList<Any>(), env.fs.calls)
    }

    @Test
    fun `climbs no further than the root`() {
        val machine = CorpusMachine(HubPlatform.LINUX, emptyMap(), emptyList(), emptyList())

        assertNull(Authz(machine).resolveRealPath("/ws/a.erd.json"))
        assertEquals(listOf("/ws/a.erd.json", "/ws", "/"), machine.realPathCalls)
        assertEquals(listOf("/ws/a.erd.json", "/ws"), machine.lstatCalls)
    }

    @Test
    fun `neither climbs nor looks at the entry when realpath fails for any reason but a missing one`() {
        val loop = listOf("/ws/loop.erd.json")
        val machine = CorpusMachine(HubPlatform.LINUX, emptyMap(), existing = loop, failing = loop)

        assertNull(Authz(machine).resolveRealPath("/ws/loop.erd.json"))
        assertEquals(listOf("/ws/loop.erd.json"), machine.realPathCalls)
        assertEquals(emptyList<String>(), machine.lstatCalls)
    }

    @Test
    fun `answers no real path when the machine itself throws`() {
        val env = FakeEnvironment()
        env.fs.addDir("/ws")
        env.failNext(FakeOp.REAL_PATH, IllegalStateException("realpath broke"))
        env.failNext(FakeOp.REAL_PATH, IllegalStateException("realpath broke again"))
        val authz = Authz(env)

        assertNull(authz.resolveRealPath("/ws/a.erd.json"))
        assertEquals("/ws", authz.realpathOrSelf("/ws"))
        env.failNext(FakeOp.LSTAT, SecurityException("lstat broke"))
        assertNull(authz.resolveRealPath("/ws/a.erd.json"))
        assertEquals("/ws/a.erd.json", authz.resolveRealPath("/ws/a.erd.json"))
    }

    @Test
    fun `falls back to the path it was given`() {
        val env = FakeEnvironment()
        env.fs.addDir("/real")
        env.links["/ws"] = "/real"

        assertEquals("/real", Authz(env).realpathOrSelf("/ws"))
        assertEquals("/gone", Authz(env).realpathOrSelf("/gone"))
    }

    @Test
    fun `never doubles a separator after a root`() {
        val posix = CorpusMachine(HubPlatform.LINUX, emptyMap(), listOf("/"), emptyList())
        val windows = CorpusMachine(HubPlatform.WIN32, emptyMap(), listOf("C:\\"), emptyList())

        assertEquals("/new.erd.json", Authz(posix).resolveRealPath("/new.erd.json"))
        assertEquals("C:\\new.erd.json", Authz(windows).resolveRealPath("C:\\new.erd.json"))
    }

    @Test
    fun `climbs a Windows share, and no further than its root`() {
        val share = CorpusMachine(HubPlatform.WIN32, emptyMap(), listOf("\\\\server\\share\\ws"), emptyList())
        val nothing = CorpusMachine(HubPlatform.WIN32, emptyMap(), emptyList(), emptyList())

        val created = "\\\\server\\share\\ws\\new\\b.erd.json"

        assertEquals(created, Authz(share).resolveRealPath(created))
        assertNull(Authz(nothing).resolveRealPath("\\\\server\\share\\a.erd.json"))
        assertEquals(listOf("\\\\server\\share\\a.erd.json", "\\\\server\\share\\"), nothing.realPathCalls)
    }

    @Test
    fun `refuses a path outside the workspace after asking only realpath and lstat, and writes nothing`() {
        val env = FakeEnvironment()
        env.fs.addDir("/ws")
        env.fs.clearCalls()
        val scope = AuthScope(listOf("/ws"), emptyList())

        val outside = "/etc/elsewhere.erd.json"

        val refusal = assertThrows(HubRequestError::class.java) { Authz(env).authorizePath(scope, outside) }

        assertEquals(HubErrorCode.OUTSIDE_WORKSPACE, refusal.code)
        assertEquals("$outside is neither inside a workspace folder nor an open document", refusal.message)
        assertEquals(setOf(FakeOp.REAL_PATH, FakeOp.LSTAT), env.fs.calls.map { it.op }.toSet())
        assertFalse(env.fs.exists("/etc/elsewhere.erd.json"))
    }

    @Test
    fun `lets a path inside a linked workspace folder through under its real path`() {
        val env = FakeEnvironment()
        env.fs.addFile("/real/a.erd.json")
        env.links["/link"] = "/real"
        val authz = Authz(env)

        val scope = AuthScope(listOf(authz.realpathOrSelf("/link")), emptyList())

        val real = authz.authorizePath(scope, "/link/a.erd.json")

        assertEquals("/real/a.erd.json", real)
    }

    @Test
    fun `compares paths by the platform this machine runs on`() {
        for ((platform, admitted) in listOf(HubPlatform.DARWIN to true, HubPlatform.LINUX to false)) {
            val env = FakeEnvironment(platform = platform)
            env.fs.addDir("/WS")
            val scope = AuthScope(listOf("/WS"), emptyList())

            val outcome = runCatching { Authz(env).authorizePath(scope, "/ws/a.erd.json") }

            assertEquals("$platform", admitted, outcome.isSuccess)
        }
    }

    @Test
    fun `refuses a dangling symlink in the workspace and creates nothing at its target`() {
        val env = FakeEnvironment()
        env.fs.addDir("/ws")
        env.links["/ws/schema.erd.json"] = "/outside/planted.erd.json"

        val refusal = assertThrows(HubRequestError::class.java) {
            Authz(env).authorizePath(AuthScope(listOf("/ws"), emptyList()), "/ws/schema.erd.json")
        }

        assertEquals("/ws/schema.erd.json has no real path the hub can check, such as a dangling link", refusal.message)
        assertFalse(env.fs.exists("/outside/planted.erd.json"))
    }

    @Test
    fun `admits only the open document in a window without folders, and nothing once it closed`() {
        val env = FakeEnvironment()
        env.fs.addFile("/notes/open.erd.json")
        env.fs.addFile("/notes/closed.erd.json")
        val authz = Authz(env)
        val open = AuthScope(emptyList(), listOf("/notes/open.erd.json"))

        assertEquals("/notes/open.erd.json", authz.authorizePath(open, "/notes/open.erd.json"))
        for (path in listOf("/notes/closed.erd.json", "/notes/new.erd.json")) {
            val refusal = assertThrows(HubRequestError::class.java) { authz.authorizePath(open, path) }
            assertEquals("$path is neither inside a workspace folder nor an open document", refusal.message)
        }
        assertThrows(HubRequestError::class.java) { authz.authorizePath(AuthScope.EMPTY, "/notes/open.erd.json") }
        assertEquals(AuthScope(emptyList(), emptyList()), AuthScope.EMPTY)
    }

    @Test
    fun `refuses both ways a write could follow a symlink out of the workspace on the real file system`() {
        val root = tempDir()
        val ws = Files.createDirectory(root.resolve("ws"))
        val outside = Files.createDirectory(root.resolve("outside"))
        Files.createSymbolicLink(ws.resolve("schema.erd.json"), outside.resolve("planted.erd.json"))
        Files.createSymbolicLink(ws.resolve("link"), outside)
        val authz = Authz(machine(root))
        val scope = AuthScope(listOf(ws.toString()), emptyList())

        val escapes = listOf("$ws/schema.erd.json", "$ws/missing/../link/x.erd.json", "$ws/link/x.erd.json")
        for (escape in escapes) {
            val refusal = assertThrows(escape, HubRequestError::class.java) { authz.authorizePath(scope, escape) }
            assertEquals(HubErrorCode.OUTSIDE_WORKSPACE, refusal.code)
        }
        val created = ws.resolve("new").resolve("b.erd.json").toString()
        assertEquals(created, authz.authorizePath(scope, created))
        assertEquals(emptyList<Path>(), Files.list(outside).use { it.toList() })
    }

    @Test
    fun `refuses a path no file system takes, such as one holding NUL, without throwing anything else`() {
        val root = tempDir()
        val ws = Files.createDirectory(root.resolve("ws")).toString()
        val target = "$ws/a\u0000.erd"

        val refusal = assertThrows(HubRequestError::class.java) {
            Authz(machine(root)).authorizePath(AuthScope(listOf(ws), emptyList()), target)
        }

        // Windows refuses every character below U+0020 in a name, so the hub does before any lookup.
        if (HubPlatform.current().isWindows) {
            assertEquals(HubErrorCode.BAD_REQUEST, refusal.code)
            assertEquals(HubTexts.unsafeName(target, "a\u0000.erd"), refusal.message)
        } else {
            assertEquals(HubErrorCode.OUTSIDE_WORKSPACE, refusal.code)
            assertEquals("$target has no real path the hub can check, such as a dangling link", refusal.message)
        }
    }

    @Test
    fun `resolves a path on the real file system through its links`() {
        val root = tempDir()
        val real = Files.createDirectory(root.resolve("real"))
        Files.writeString(real.resolve("a.erd.json"), "{}")
        Files.createDirectory(real.resolve("sub"))
        val link = Files.createSymbolicLink(root.resolve("ws"), real)
        val authz = Authz(machine(root))
        val beside = real.resolve("x.erd.json").toString()
        val separator = real.fileSystem.separator

        assertEquals("$real${separator}a.erd.json", authz.resolveRealPath(link.resolve("a.erd.json").toString()))
        assertEquals("$real${separator}new${separator}b.erd.json", authz.resolveRealPath("$link/new/b.erd.json"))
        // The OS resolves .. behind an existing directory; a missing one leaves it in the tail, and nothing resolves.
        assertEquals(beside, authz.resolveRealPath("$link/sub/../x.erd.json"))
        // Windows folds "missing\.." before it opens anything, as Node's realpath there does too.
        val windows = HubPlatform.current().isWindows
        assertEquals(if (windows) beside else null, authz.resolveRealPath("$link/missing/../x.erd.json"))
    }

    @Test
    fun `splits paths as node's path module does, posix and win32`() {
        for ((path, dirname, basename) in POSIX_SPLITS) {
            assertEquals("dirname $path", dirname, NodeDirs.dirname(path, HubPlatform.LINUX))
            assertEquals("basename $path", basename, NodeDirs.basename(path, HubPlatform.DARWIN))
        }
        for ((path, dirname, basename) in WIN32_SPLITS) {
            assertEquals("dirname $path", dirname, NodeDirs.dirname(path, HubPlatform.WIN32))
            assertEquals("basename $path", basename, NodeDirs.basename(path, HubPlatform.WIN32))
        }
    }

    private fun tempDir(): Path = Files.createTempDirectory("hub-authz-").toRealPath().also { temps.add(it) }

    private fun machine(root: Path) =
        MachineEnvironment(root.resolve("home").toString(), root.toString(), HubPlatform.current(), 4242, "0.0.0-test")

    /**
     * The memory machine of one corpus vector, as the corpus's $comment describes it: links followed
     * once, the first match winning, and an entry wherever an existing path is or lies under.
     */
    private class CorpusMachine(
        override val platform: HubPlatform,
        private val links: Map<String, String>,
        private val existing: List<String>,
        private val failing: List<String>,
    ) : HubEnvironment by FakeEnvironment(platform = platform) {
        private val separator = if (platform.isWindows) "\\" else "/"
        val realPathCalls = ArrayList<String>()
        val lstatCalls = ArrayList<String>()

        override fun realPath(path: String): RealPathResult {
            realPathCalls += path
            if (path in failing) return RealPathResult.Other(IOException("busy: $path"))
            val real = follow(path)
            return if (exists(real)) RealPathResult.Ok(real) else RealPathResult.NotFound
        }

        override fun lstat(path: String): LstatResult {
            lstatCalls += path
            return if (path in links || exists(follow(path))) LstatResult.EXISTS else LstatResult.NOT_FOUND
        }

        private fun follow(path: String): String {
            val link = links.entries.firstOrNull { (from) -> path == from || path.startsWith(from + separator) }
            return if (link == null) path else link.value + path.substring(link.key.length)
        }

        private fun exists(path: String): Boolean {
            val prefix = if (path.endsWith(separator)) path else path + separator
            return existing.any { it == path || it.startsWith(prefix) }
        }
    }

    private companion object {
        // Each row as node:path answers it (node -e 'path.posix.dirname(p)', 'path.win32.basename(p)', …).
        val POSIX_SPLITS = listOf(
            Triple("/", "/", ""), Triple("//", "/", ""), Triple("///", "/", ""), Triple("/a", "/", "a"),
            Triple("/a/", "/", "a"), Triple("/a//", "/", "a"), Triple("//a", "//", "a"), Triple("/a/b", "/a", "b"),
            Triple("/a/b/", "/a", "b"), Triple("/a//b", "/a/", "b"), Triple("/ws/sub/..", "/ws/sub", ".."),
            Triple("/ws/./x", "/ws/.", "x"), Triple("a", ".", "a"), Triple("", ".", ""), Triple("a/b", "a", "b"),
            Triple("//a/b", "//a", "b"), Triple("/a\\b", "/", "a\\b"),
        )
        val WIN32_SPLITS = listOf(
            Triple("C:\\", "C:\\", ""), Triple("C:/", "C:/", ""), Triple("C:", "C:", ""), Triple("C:\\a", "C:\\", "a"),
            Triple("C:\\a\\", "C:\\", "a"), Triple("C:a", "C:", "a"), Triple("C:\\a\\b", "C:\\a", "b"),
            Triple("C:/a/b", "C:/a", "b"), Triple("\\", "\\", ""), Triple("/", "/", ""), Triple("\\a", "\\", "a"),
            Triple("/a\\b", "/a", "b"), Triple("\\\\server\\share", "\\\\server\\share", "share"),
            Triple("\\\\server\\share\\", "\\\\server\\share\\", "share"),
            Triple("\\\\server\\share\\a", "\\\\server\\share\\", "a"),
            Triple("\\\\server\\share\\a\\b", "\\\\server\\share\\a", "b"), Triple("\\\\server", "\\", "server"),
            Triple("\\\\server\\", "\\", "server"), Triple("\\\\\\x", "\\\\", "x"),
            Triple("//server/share/a", "//server/share/", "a"), Triple("\\\\?\\C:\\a", "\\\\?\\C:\\", "a"),
            Triple("C:\\a\\..", "C:\\a", ".."), Triple("a\\b", "a", "b"), Triple("", ".", ""), Triple("x", ".", "x"),
            Triple("\\\\server\\share\\\\a", "\\\\server\\share\\", "a"), Triple("C:\\\\a", "C:\\", "a"),
            Triple("ab\\c", "ab", "c"), Triple("ab", ".", "ab"), Triple("é:\\a", "é:", "a"),
            Triple("|:\\a", "|:", "a"),
            Triple("Z:\\a", "Z:\\", "a"), Triple("\\\\a\\\\b", "\\\\a\\\\b", "b"),
            Triple("\\\\server\\\\", "\\", "server"),
        )
    }
}
