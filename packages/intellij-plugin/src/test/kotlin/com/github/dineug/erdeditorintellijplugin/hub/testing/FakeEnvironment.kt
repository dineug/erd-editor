package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.HubEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.LstatResult
import com.github.dineug.erdeditorintellijplugin.hub.RealPathResult
import java.io.IOException
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * The machine the hub suites run on, as packages/agent-hub-host's memory hub: home /home/user,
 * tmp /tmp, pid 4242 (alive), tokens token-1, token-2, …; nothing touches the real home. realPath
 * follows [links] and succeeds where [fs] has an entry; every call is recorded in fs.calls.
 */
class FakeEnvironment(
    override val homeDir: String = "/home/user",
    override val tmpDir: String = "/tmp",
    override val platform: HubPlatform = HubPlatform.LINUX,
    override val pid: Long = 4242,
    override val version: String = "0.0.0-test",
    override val fs: FakeFileSystem = FakeFileSystem(),
    override val clock: FakeClock = FakeClock(),
) : HubEnvironment {
    private val tokens = AtomicInteger()

    /** The pids isAlive answers true for; this process's own at first. */
    val alive: MutableSet<Long> = ConcurrentHashMap.newKeySet<Long>().apply { add(pid) }

    /** Symlinks: a path equal to a key, or under it, resolves under its value; the first match wins. */
    val links: MutableMap<String, String> = Collections.synchronizedMap(LinkedHashMap())

    /** Paths whose realPath fails for another reason than a missing entry (a loop, a busy mount). */
    val realPathFails: MutableSet<String> = ConcurrentHashMap.newKeySet()

    /** The next call of op throws error; op may be a file system or an environment operation. */
    fun failNext(op: FakeOp, error: Throwable) = fs.failNext(op, error)

    /** The next call of op waits until the hold is released. */
    fun hold(op: FakeOp): FakeHold = fs.hold(op)

    override fun randomToken(): String = "token-${tokens.incrementAndGet()}"

    override fun isAlive(pid: Long): Boolean {
        fs.enter(FakeOp.IS_ALIVE, pid)
        return pid in alive
    }

    override fun realPath(path: String): RealPathResult {
        fs.enter(FakeOp.REAL_PATH, path)
        if (path in realPathFails) return RealPathResult.Other(IOException("realpath failed on $path"))
        val real = follow(path)
        return if (fs.exists(real)) RealPathResult.Ok(real) else RealPathResult.NotFound
    }

    /** A link is an entry even when its target is missing, as a dangling symlink is. */
    override fun lstat(path: String): LstatResult {
        fs.enter(FakeOp.LSTAT, path)
        return if (links.containsKey(path) || fs.exists(follow(path))) LstatResult.EXISTS else LstatResult.NOT_FOUND
    }

    override fun removeFileSync(path: String) {
        fs.enter(FakeOp.REMOVE_FILE_SYNC, path)
        fs.removeFileQuietly(path)
    }

    private fun follow(path: String): String {
        val link = synchronized(links) {
            links.entries.firstOrNull { (from) -> path == from || path.startsWith("$from/") }
        }
        return if (link == null) path else link.value + path.substring(link.key.length)
    }
}
