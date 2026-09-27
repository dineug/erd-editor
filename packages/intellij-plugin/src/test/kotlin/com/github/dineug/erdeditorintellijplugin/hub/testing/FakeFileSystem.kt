package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.HubFileSystem
import java.io.IOException
import java.nio.file.DirectoryNotEmptyException
import java.nio.file.FileAlreadyExistsException
import java.nio.file.FileSystemException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Every operation a fake can record, fail or hold: the HubFileSystem calls, then the environment's own. */
enum class FakeOp {
    MAKE_DIRECTORIES, DELETE_IF_EXISTS, WRITE_NEW_FILE, MOVE_REPLACING, LIST_NAMES, READ_TEXT, MTIME_MS,
    STAT_EXISTING, CREATE_EXCLUSIVE, REAL_PATH, LSTAT, IS_ALIVE, REMOVE_FILE_SYNC,
}

/** One recorded call: the operation and its arguments, in the order the hub passed them. */
data class FakeCall(val op: FakeOp, val args: List<Any?>)

/**
 * A call held until the test releases it, the way a stalled file system holds a real one. The
 * wait ignores interrupts, as a blocking file call does, and gives up after [capMs] so a test that
 * forgot to release it fails instead of hanging.
 */
class FakeHold internal constructor(private val op: FakeOp, private val capMs: Long) {
    private val entered = CountDownLatch(1)
    private val released = CountDownLatch(1)

    val isEntered: Boolean get() = entered.count == 0L

    fun awaitEntered(timeoutMs: Long = 5_000) {
        if (!entered.await(timeoutMs, TimeUnit.MILLISECONDS)) {
            throw AssertionError("$op was not called within $timeoutMs ms")
        }
    }

    fun release() {
        released.countDown()
    }

    internal fun block() {
        entered.countDown()
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(capMs)
        var interrupted = false
        while (released.count > 0) {
            val left = deadline - System.nanoTime()
            if (left <= 0) throw IOException("$op was held for $capMs ms and never released")
            try {
                released.await(left, TimeUnit.NANOSECONDS)
            } catch (e: InterruptedException) {
                interrupted = true
            }
        }
        if (interrupted) Thread.currentThread().interrupt()
    }
}

/**
 * A HubFileSystem over an in-memory tree of exact path strings (POSIX style: a parent is everything
 * before the last slash), or passing every call through to [delegate], such as NioFileSystem on a
 * temp dir. Either way every call is recorded, and failNext or hold makes one fail or stall.
 */
class FakeFileSystem(private val delegate: HubFileSystem? = null) : HubFileSystem {
    private sealed interface Node {
        data class Dir(val mode: Int) : Node

        data class File(val text: String, val mode: Int, val mtimeMs: Long) : Node
    }

    private val lock = Any()
    private val nodes = LinkedHashMap<String, Node>().apply { put("/", Node.Dir(DEFAULT_DIR_MODE)) }
    private val recorded = ArrayList<FakeCall>()
    private val failures = HashMap<FakeOp, ArrayDeque<Throwable>>()
    private val holds = HashMap<FakeOp, ArrayDeque<FakeHold>>()

    val calls: List<FakeCall> get() = synchronized(lock) { recorded.toList() }

    /** The arguments of every call of op, in order. */
    fun callsOf(op: FakeOp): List<List<Any?>> = calls.filter { it.op == op }.map { it.args }

    fun clearCalls() {
        synchronized(lock) { recorded.clear() }
    }

    /** The next call of op throws error instead of acting; queued failures apply one per call. */
    fun failNext(op: FakeOp, error: Throwable) {
        synchronized(lock) { failures.getOrPut(op) { ArrayDeque() }.addLast(error) }
    }

    /** Drops every failure still queued, so the calls after it act. */
    fun clearFailures() {
        synchronized(lock) { failures.clear() }
    }

    /** The next call of op waits, after being recorded, until the returned hold is released. */
    fun hold(op: FakeOp, capMs: Long = HOLD_CAP_MS): FakeHold =
        FakeHold(op, capMs).also { hold -> synchronized(lock) { holds.getOrPut(op) { ArrayDeque() }.addLast(hold) } }

    /** Records a call, then applies a hold and a failure queued for its operation. */
    fun enter(op: FakeOp, vararg args: Any?) {
        val (hold, failure) = synchronized(lock) {
            recorded += FakeCall(op, args.toList())
            holds[op]?.removeFirstOrNull() to failures[op]?.removeFirstOrNull()
        }
        hold?.block()
        if (failure != null) throw failure
    }

    fun addDir(path: String, mode: Int = DEFAULT_DIR_MODE) {
        synchronized(lock) { memory().makeDirs(path, mode) }
    }

    fun addFile(path: String, text: String = "", mode: Int = DEFAULT_FILE_MODE, mtimeMs: Long = 1) {
        synchronized(lock) {
            memory().makeDirs(parentOf(path), DEFAULT_DIR_MODE)
            nodes[path] = Node.File(text, mode, mtimeMs)
        }
    }

    /** Whether an entry is at path: in the tree, or on disk for a delegating fake (links not followed). */
    fun exists(path: String): Boolean =
        if (delegate != null) {
            Files.exists(Path.of(path), LinkOption.NOFOLLOW_LINKS)
        } else {
            synchronized(lock) { path in nodes }
        }

    fun isDirectory(path: String): Boolean = synchronized(lock) { memory().nodes[path] is Node.Dir }

    /** The text of the file at path as written, BOM and all; null when no file is there. */
    fun textOf(path: String): String? = synchronized(lock) { (memory().nodes[path] as? Node.File)?.text }

    fun modeOf(path: String): Int? = synchronized(lock) {
        when (val node = memory().nodes[path]) {
            is Node.Dir -> node.mode
            is Node.File -> node.mode
            null -> null
        }
    }

    /** Every file's path in the tree, in the order it was created. */
    fun files(): List<String> = synchronized(lock) { memory().nodes.filterValues { it is Node.File }.keys.toList() }

    /** Deletes the file at path, never a directory, never throwing, unrecorded: removeFileSync's effect. */
    fun removeFileQuietly(path: String) {
        if (delegate != null) {
            runCatching {
                val file = Path.of(path)
                if (!Files.isDirectory(file, LinkOption.NOFOLLOW_LINKS)) Files.deleteIfExists(file)
            }
            return
        }
        synchronized(lock) { if (nodes[path] is Node.File) nodes.remove(path) }
    }

    override fun makeDirectories(dir: String, posixMode: Int?) {
        enter(FakeOp.MAKE_DIRECTORIES, dir, posixMode)
        delegate?.let { return it.makeDirectories(dir, posixMode) }
        synchronized(lock) { makeDirs(dir, posixMode ?: DEFAULT_DIR_MODE) }
    }

    override fun deleteIfExists(path: String) {
        enter(FakeOp.DELETE_IF_EXISTS, path)
        delegate?.let { return it.deleteIfExists(path) }
        synchronized(lock) {
            when (nodes[path]) {
                is Node.File -> nodes.remove(path)
                is Node.Dir -> {
                    if (path == "/" || nodes.keys.any { it != path && parentOf(it) == path }) {
                        throw DirectoryNotEmptyException(path)
                    }
                    nodes.remove(path)
                }
                null -> {}
            }
        }
    }

    override fun writeNewFile(path: String, text: String, posixMode: Int?) {
        enter(FakeOp.WRITE_NEW_FILE, path, text, posixMode)
        delegate?.let { return it.writeNewFile(path, text, posixMode) }
        synchronized(lock) { create(path, text, posixMode ?: DEFAULT_FILE_MODE) }
    }

    override fun moveReplacing(from: String, to: String) {
        enter(FakeOp.MOVE_REPLACING, from, to)
        delegate?.let { return it.moveReplacing(from, to) }
        synchronized(lock) {
            val node = nodes[from] as? Node.File ?: throw NoSuchFileException(from)
            if (nodes[parentOf(to)] !is Node.Dir) throw NoSuchFileException(to)
            if (nodes[to] is Node.Dir) throw FileSystemException(to, null, "Is a directory")
            nodes.remove(from)
            nodes[to] = node
        }
    }

    override fun listNames(dir: String): List<String>? {
        enter(FakeOp.LIST_NAMES, dir)
        delegate?.let { return it.listNames(dir) }
        return synchronized(lock) {
            if (nodes[dir] !is Node.Dir) return null
            nodes.keys.filter { it != dir && parentOf(it) == dir }.map { it.substring(it.lastIndexOf('/') + 1) }
        }
    }

    override fun readText(path: String): String {
        enter(FakeOp.READ_TEXT, path)
        delegate?.let { return it.readText(path) }
        return synchronized(lock) { file(path).text.removePrefix("\uFEFF") }
    }

    override fun mtimeMs(path: String): Long {
        enter(FakeOp.MTIME_MS, path)
        delegate?.let { return it.mtimeMs(path) }
        return synchronized(lock) { file(path).mtimeMs }
    }

    override fun statExisting(path: String) {
        enter(FakeOp.STAT_EXISTING, path)
        delegate?.let { return it.statExisting(path) }
        synchronized(lock) { if (path !in nodes) throw NoSuchFileException(path) }
    }

    override fun createExclusive(path: String, text: String) {
        enter(FakeOp.CREATE_EXCLUSIVE, path, text)
        delegate?.let { return it.createExclusive(path, text) }
        synchronized(lock) { create(path, text, DEFAULT_FILE_MODE) }
    }

    private fun memory(): FakeFileSystem = also {
        check(delegate == null) { "the tree helpers need an in-memory FakeFileSystem" }
    }

    private fun makeDirs(path: String, mode: Int) {
        when (nodes[path]) {
            is Node.Dir -> return
            is Node.File -> throw FileAlreadyExistsException(path)
            null -> {}
        }
        if (path != "/") makeDirs(parentOf(path), mode)
        nodes[path] = Node.Dir(mode)
    }

    private fun create(path: String, text: String, mode: Int) {
        if (nodes[parentOf(path)] !is Node.Dir) throw NoSuchFileException(path)
        if (path in nodes) throw FileAlreadyExistsException(path)
        nodes[path] = Node.File(text, mode, System.currentTimeMillis())
    }

    private fun file(path: String): Node.File = when (val node = nodes[path]) {
        is Node.File -> node
        is Node.Dir -> throw FileSystemException(path, null, "Is a directory")
        null -> throw NoSuchFileException(path)
    }

    companion object {
        const val DEFAULT_DIR_MODE: Int = 493 // 0o755
        const val DEFAULT_FILE_MODE: Int = 420 // 0o644
        const val HOLD_CAP_MS: Long = 30_000

        fun parentOf(path: String): String {
            val index = path.lastIndexOf('/')
            return if (index <= 0) "/" else path.substring(0, index)
        }
    }
}
