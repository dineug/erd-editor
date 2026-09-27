package com.github.dineug.erdeditorintellijplugin.hub.server

import com.github.dineug.erdeditorintellijplugin.hub.AuthScope
import com.github.dineug.erdeditorintellijplugin.hub.HubErrorCode
import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.HubRequestError
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.LockPaths
import com.github.dineug.erdeditorintellijplugin.hub.LockRecord
import com.github.dineug.erdeditorintellijplugin.hub.parseLock
import com.github.dineug.erdeditorintellijplugin.hub.serializeLock
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeListenerFactory
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeOp
import com.github.dineug.erdeditorintellijplugin.hub.testing.MemoryChannel
import com.github.dineug.erdeditorintellijplugin.hub.testing.MemoryDocuments
import com.github.dineug.erdeditorintellijplugin.hub.testing.MemoryHost
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingHandler
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import com.github.dineug.erdeditorintellijplugin.hub.transport.HubListenException
import kotlinx.coroutines.CompletableDeferred
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.io.IOException
import java.nio.file.AccessDeniedException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/**
 * DocumentHub's lifecycle over the fake machine and listener, as agent-hub-host's DocumentHub,
 * lockFile and pipePath tests hold DocumentHub.ts: the lock by what the host enables, its folders
 * and documents, the publish wait, close and releaseSync, the pipe path, and what the Kotlin port
 * adds: the scope hook the registry revokes by, detach, and a close bounded against a stalled task.
 */
class DocumentHubTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    @get:Rule
    val testThreads = TestThreads()

    private val log = RecordingLog()
    private val handler = RecordingHandler()
    private val hubs = CopyOnWriteArrayList<DocumentHub>()
    private val threads by lazy { testThreads.create(log) }

    @After
    fun tearDown() {
        hubs.forEach { it.close(2_000) }
    }

    /** One hub over its own fake machine, host, documents and listener, not started yet. */
    private inner class Fixture(
        val env: FakeEnvironment = FakeEnvironment(),
        val host: MemoryHost = MemoryHost(),
        val documents: MemoryDocuments = MemoryDocuments(),
        timings: HubTimings = TIMINGS,
        hubLog: HubLog = log,
    ) {
        val listeners = FakeListenerFactory(env)
        val lockPath: String = LockPaths.lockFilePath(env.homeDir, env.pid)

        /** Every scope the hub handed its hook, with the thread and the lock on disk at that moment. */
        val hooks = CopyOnWriteArrayList<Hook>()
        val hub = DocumentHub(env, host, documents, handler, listeners, threads, hubLog, timings) { scope ->
            hooks += Hook(scope, Thread.currentThread().name, lock())
        }.also(hubs::add)

        fun start() = apply { hub.start() }

        /** Every state change queued so far has run. */
        fun flush() {
            hub.flushed().get(5, TimeUnit.SECONDS)
        }

        fun lock(): LockRecord? = env.fs.textOf(lockPath)?.let { parseLock(it) ?: error("not a lock: $it") }

        fun turn(enabled: Boolean) {
            host.turn(enabled)
            flush()
        }

        fun setDocuments(vararg paths: String) {
            hub.setDocuments(paths.toList()).get(5, TimeUnit.SECONDS)
        }

        /** Connects to the pipe the lock names and says hello with its token; the answer is the first frame. */
        fun connectToLock(): MemoryChannel {
            val lock = lock() ?: error("no lock")
            assertTrue("the lock serves", lock.hub)
            return listeners.connect(lock.pipe).apply {
                send("""{"id":1,"method":"hello","params":{"token":"${lock.token}","protocolVersion":1,"client":"spec"}}""")
                awaitUntil(message = "the hello answered") { received.isNotEmpty() }
            }
        }

        fun removedSync(): List<Any?> = env.fs.callsOf(FakeOp.REMOVE_FILE_SYNC).map { it.single() }
    }

    private data class Hook(val scope: AuthScope, val thread: String, val lock: LockRecord?)

    private fun started(host: MemoryHost = MemoryHost(), env: FakeEnvironment = FakeEnvironment()) =
        Fixture(env = env, host = host).start().apply { flush() }

    private fun startedOff() = started(MemoryHost(enabled = false))

    private fun record(
        pipe: String = SOCKET,
        folders: List<String> = emptyList(),
        documents: List<String> = emptyList(),
        ide: String = "memory-ide",
        token: String = "token-1",
    ) = LockRecord(pipe, folders, documents, ide, "0.0.0-test", 1, token, pipe.isNotEmpty())

    @Test
    fun `writes only a hub false lock while the host has it off, and never listens`() {
        val fixture = startedOff()

        assertEquals(emptyList<String>(), fixture.listeners.listens)
        assertEquals(record(pipe = "", token = ""), fixture.lock())
        assertEquals(LockPaths.LOCK_FILE_MODE, fixture.env.fs.modeOf(LOCK))
    }

    @Test
    fun `starts serving once the host turns it on, and the lock then names the pipe and a token`() {
        val fixture = startedOff()

        fixture.turn(true)

        assertEquals(listOf(SOCKET), fixture.listeners.listens)
        assertEquals(record(), fixture.lock())
    }

    @Test
    fun `says hello with the name of its host`() {
        val fixture = started(MemoryHost(ide = "obsidian"))

        val peer = fixture.connectToLock()

        assertEquals(
            """{"id":1,"ok":true,"method":"hello","result":{"protocolVersion":1,"ide":"obsidian","version":"0.0.0-test"}}""",
            peer.received.single(),
        )
    }

    @Test
    fun `keeps a hub false lock when the host turns it on but the pipe cannot listen`() {
        val fixture = startedOff()
        fixture.listeners.failListenOnce()
        fixture.env.fs.clearCalls()

        fixture.turn(true)

        assertEquals(1, fixture.listeners.listens.size)
        assertEquals(1, fixture.env.fs.callsOf(FakeOp.MOVE_REPLACING).size)
        assertEquals(record(pipe = "", token = ""), fixture.lock())
    }

    @Test
    fun `retries listening on the next event after a failure`() {
        val fixture = Fixture()
        fixture.listeners.failListenOnce()
        fixture.start().flush()

        fixture.host.fireEnabledChange()
        fixture.flush()

        assertEquals(2, fixture.listeners.listens.size)
        assertEquals(record(token = "token-2"), fixture.lock())
    }

    @Test
    fun `keeps serving through an event that changes nothing`() {
        val fixture = started()

        fixture.host.fireEnabledChange()
        fixture.flush()

        assertEquals(1, fixture.listeners.listens.size)
        assertEquals(record(), fixture.lock())
    }

    @Test
    fun `turns the lock to hub false before closing the pipe, and sends a peer nothing on its way out`() {
        val fixture = started()
        val peer = fixture.connectToLock()
        val lockAtClose = CompletableFuture<LockRecord?>()
        fixture.listeners.onClose = { lockAtClose.complete(fixture.lock()) }

        fixture.turn(false)

        assertEquals(record(pipe = "", token = ""), fixture.lock())
        assertEquals("the lock at the listener's close", record(pipe = "", token = ""), lockAtClose.get(5, TimeUnit.SECONDS))
        assertTrue(peer.isDestroyed)
        assertEquals("only the hello answer, no documentClosed", 1, peer.received.size)
        assertEquals(emptySet<String>(), fixture.listeners.listening)
        assertFalse(fixture.env.fs.exists(SOCKET))
        awaitUntil(message = "the peer disconnected") { handler.disconnects.size == 1 }
    }

    @Test
    fun `serves again with a new token when the host turns it back on`() {
        val fixture = started()
        fixture.turn(false)

        fixture.turn(true)

        assertEquals(2, fixture.listeners.listens.size)
        assertEquals(record(token = "token-2"), fixture.lock())
    }

    @Test
    fun `logs and carries on when asking the host throws`() {
        val fixture = started()
        val failure = IllegalStateException("settings.json is not JSON")
        fixture.host.throwOnEnabled = failure

        fixture.host.fireEnabledChange()
        fixture.flush()
        fixture.setDocuments("/elsewhere/a.erd.json")

        assertEquals(listOf("" to failure), log.lines)
        assertEquals(record(documents = listOf("/elsewhere/a.erd.json")), fixture.lock())
    }

    @Test
    fun `guards with a hub false lock when the host cannot answer at start, and serves on its next event`() {
        val host = MemoryHost().apply { throwOnEnabled = IllegalStateException("settings.json is not JSON") }
        val fixture = started(host)
        assertEquals("the published documents' write guards", record(pipe = "", token = ""), fixture.lock())

        fixture.setDocuments("/elsewhere/a.erd.json")
        assertEquals(record(pipe = "", token = "", documents = listOf("/elsewhere/a.erd.json")), fixture.lock())

        host.fireEnabledChange()
        fixture.flush()
        assertEquals(record(documents = listOf("/elsewhere/a.erd.json")), fixture.lock())
    }

    @Test
    fun `lists the real path of every host folder`() {
        val env = FakeEnvironment().apply {
            fs.addDir("/real/project")
            links["/link"] = "/real"
        }
        val fixture = started(MemoryHost(roots = listOf("/link/project")), env)

        assertEquals(listOf("/real/project"), fixture.lock()?.workspaceFolders)
    }

    @Test
    fun `rewrites the lock when the host reports its folders changed, and never listens for it`() {
        val env = FakeEnvironment().apply {
            fs.addDir("/a")
            fs.addDir("/b")
        }
        val fixture = started(MemoryHost(roots = listOf("/a")), env)

        fixture.host.roots = listOf("/a", "/b")
        fixture.host.fireFoldersChange()
        fixture.flush()

        assertEquals(listOf("/a", "/b"), fixture.lock()?.workspaceFolders)
        assertEquals(1, fixture.listeners.listens.size)
    }

    @Test
    fun `keeps a folder whose realpath fails under the path the host gave`() {
        val fixture = started(MemoryHost(roots = listOf("/gone")))

        assertEquals(listOf("/gone"), fixture.lock()?.workspaceFolders)
    }

    @Test
    fun `logs and keeps the folders it had when the host cannot list them`() {
        val env = FakeEnvironment().apply { fs.addDir("/a") }
        val fixture = started(MemoryHost(roots = listOf("/a")), env)
        val failure = IllegalStateException("no folders")
        fixture.host.throwOnFolders = failure

        fixture.host.fireFoldersChange()
        fixture.flush()

        assertEquals(listOf("" to failure), log.lines)
        assertEquals(listOf("/a"), fixture.lock()?.workspaceFolders)
        assertEquals(AuthScope(listOf("/a"), emptyList()), fixture.hub.scope)
    }

    @Test
    fun `is written for a host without folders, and lists the open documents`() {
        val fixture = started().apply { env.fs.addFile("/notes/loose.erd.json") }

        fixture.setDocuments("/notes/loose.erd.json")

        assertEquals(record(documents = listOf("/notes/loose.erd.json")), fixture.lock())
    }

    @Test
    fun `lists the documents in a hub false lock too, since that lock guards them`() {
        val fixture = startedOff()

        fixture.setDocuments("/notes/loose.erd.json")

        assertEquals(record(pipe = "", token = "", documents = listOf("/notes/loose.erd.json")), fixture.lock())
    }

    @Test
    fun `takes the publisher once, and lists what was open when the hub started`() {
        val env = FakeEnvironment().apply { fs.addFile("/ws/a.erd.json") }
        val documents = MemoryDocuments(listOf("/ws/a.erd.json"))
        val fixture = Fixture(env = env, documents = documents).start().apply { flush() }

        assertEquals(1, documents.setPublisherCalls.get())
        assertEquals(record(documents = listOf("/ws/a.erd.json")), fixture.lock())
    }

    @Test
    fun `resolves a publish at once while a listen is ahead of it, and writes it after`() {
        val fixture = startedOff()
        val bind = fixture.listeners.holdListen()
        fixture.host.turn(true)
        bind.awaitEntered()

        fixture.documents.publish(listOf("/ws/a.erd.json")).get(5, TimeUnit.SECONDS)
        assertEquals(record(pipe = "", token = ""), fixture.lock())

        bind.release()
        fixture.flush()
        assertEquals(record(documents = listOf("/ws/a.erd.json")), fixture.lock())
    }

    @Test
    fun `resolves a publish at once while an enable is only queued behind a stalled task`() {
        val fixture = started()
        val gate = CompletableDeferred<Unit>()
        fixture.host.foldersGate = gate
        fixture.host.fireFoldersChange()
        awaitUntil(message = "the folders task stalled") { fixture.host.foldersCalls.get() == 2 }
        fixture.host.fireEnabledChange()

        fixture.documents.publish(listOf("/ws/a.erd.json")).get(5, TimeUnit.SECONDS)
        assertEquals(record(), fixture.lock())

        gate.complete(Unit)
        fixture.flush()
        assertEquals(record(documents = listOf("/ws/a.erd.json")), fixture.lock())
    }

    @Test
    fun `waits for the lock to list a document once the hub is up`() {
        val fixture = Fixture(timings = HubTimings(publishWaitMs = 20_000)).start().apply { flush() }
        val rename = fixture.env.hold(FakeOp.MOVE_REPLACING)

        val publishing = fixture.documents.publish(listOf("/ws/a.erd.json"))
        rename.awaitEntered()
        assertFalse(publishing.isDone)

        rename.release()
        publishing.get(5, TimeUnit.SECONDS)
        assertEquals(listOf("/ws/a.erd.json"), fixture.lock()?.documents)
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `resolves after the publish wait with a warning, on the registry thread, when a task ahead stalls`() {
        val logThreads = CopyOnWriteArrayList<String>()
        val threadLog = object : HubLog {
            override fun warn(text: String, detail: Any?) {
                logThreads += Thread.currentThread().name
                log.warn(text, detail)
            }
        }
        val fixture = Fixture(hubLog = threadLog).start().apply { flush() }
        val gate = CompletableDeferred<Unit>()
        fixture.host.foldersGate = gate
        fixture.host.fireFoldersChange()
        awaitUntil(message = "the folders task stalled") { fixture.host.foldersCalls.get() == 2 }

        val begun = System.nanoTime()
        val publishing = fixture.documents.publish(listOf("/elsewhere/a.erd.json"))
        assertFalse("not before the wait", publishing.isDone)
        publishing.get(5, TimeUnit.SECONDS)
        val waitedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - begun)

        // A timer never fires early, so the whole wait passed: not at once, and not at a shorter bound.
        assertTrue("resolved after $waitedMs ms", waitedMs >= TIMINGS.publishWaitMs)

        assertEquals(
            listOf("the lock did not list the open documents within 1 second; the editor opens without waiting for it"),
            log.texts,
        )
        assertTrue(logThreads.single(), logThreads.single().startsWith("${threads.namePrefix}-registry"))
        assertEquals(emptyList<String>(), fixture.lock()?.documents)
        gate.complete(Unit)
        fixture.flush()
        assertEquals(listOf("/elsewhere/a.erd.json"), fixture.lock()?.documents)
    }

    @Test
    fun `creates the lock directory 0700 and the lock 0600`() {
        val fixture = started()

        assertTrue(listOf(LOCK_DIR, LockPaths.LOCK_DIR_MODE) in fixture.env.fs.callsOf(FakeOp.MAKE_DIRECTORIES))
        assertEquals(LockPaths.LOCK_DIR_MODE, fixture.env.fs.modeOf(LOCK_DIR))
        assertEquals(LockPaths.LOCK_FILE_MODE, fixture.env.fs.modeOf(LOCK))
    }

    @Test
    fun `names the socket, a random token and the host in the lock`() {
        val env = FakeEnvironment().apply { fs.addDir("/ws") }
        val fixture = started(MemoryHost(ide = "obsidian", roots = listOf("/ws")), env)

        assertEquals(record(folders = listOf("/ws"), ide = "obsidian"), fixture.lock())
    }

    @Test
    fun `listens before the lock exists, so the lock never names a pipe that is not there`() {
        val fixture = Fixture()
        val lockAtListen = CompletableFuture<Boolean>()
        fixture.listeners.onListen = { lockAtListen.complete(fixture.env.fs.exists(LOCK)) }

        fixture.start().flush()

        assertFalse(lockAtListen.get(5, TimeUnit.SECONDS))
        assertEquals(record(), fixture.lock())
    }

    @Test
    fun `removes a socket file a dead process or an earlier hub left at its path before listening`() {
        val env = FakeEnvironment().apply { fs.addFile(SOCKET) }

        val fixture = started(env = env)

        assertEquals(record(), fixture.lock())
        assertEquals(SOCKET, fixture.removedSync().first())
    }

    @Test
    fun `writes a hub false lock naming no pipe when listening fails, so its paths stay guarded`() {
        val fixture = Fixture()
        fixture.listeners.failListenOnce()

        fixture.start().flush()

        assertEquals(record(pipe = "", token = ""), fixture.lock())
        assertEquals(LockPaths.LOCK_FILE_MODE, fixture.env.fs.modeOf(LOCK))
        val (text, detail) = log.lines.single()
        assertEquals("could not listen on $SOCKET", text)
        assertEquals("EADDRINUSE", (detail as HubListenException).message)
    }

    @Test
    fun `writes a hub false lock when the transport's natives fail to load`() {
        val fixture = Fixture()
        fixture.listeners.onListen = { throw UnsatisfiedLinkError("jnidispatch") }

        fixture.start().flush()

        assertEquals(record(pipe = "", token = ""), fixture.lock())
        val (text, detail) = log.lines.single()
        assertEquals("could not listen on $SOCKET", text)
        assertEquals("jnidispatch", (detail as UnsatisfiedLinkError).message)
    }

    @Test
    fun `neither listens nor writes a lock when the lock directory cannot be created`() {
        val fixture = Fixture()
        repeat(3) { fixture.env.failNext(FakeOp.MAKE_DIRECTORIES, AccessDeniedException(LOCK_DIR)) }

        fixture.start().flush()

        assertEquals(emptyList<String>(), fixture.listeners.listens)
        assertNull(fixture.lock())
        assertTrue(log.texts.toString(), "could not write $LOCK" in log.texts)
    }

    @Test
    fun `closes the pipe again and falls back to hub false when the lock cannot be written after listening`() {
        val fixture = Fixture()
        fixture.env.failNext(FakeOp.MOVE_REPLACING, IOException("busy"))

        fixture.start().flush()

        assertEquals(emptySet<String>(), fixture.listeners.listening)
        assertEquals(listOf(SOCKET), fixture.listeners.closes)
        assertFalse(fixture.env.fs.exists(SOCKET))
        assertEquals(record(pipe = "", token = ""), fixture.lock())
        assertFalse(fixture.env.fs.exists("$LOCK.tmp"))
    }

    @Test
    fun `deletes the locks of dead windows on start`() {
        val env = FakeEnvironment().apply { fs.addFile("$LOCK_DIR/100.json", serializeLock(record())) }

        val fixture = started(env = env)

        assertFalse(env.fs.exists("$LOCK_DIR/100.json"))
        assertEquals(record(), fixture.lock())
    }

    @Test
    fun `deletes the lock and the socket on close and hangs up every peer`() {
        val fixture = started()
        val peer = fixture.connectToLock()

        assertTrue(fixture.hub.close())

        assertNull(fixture.lock())
        assertFalse(fixture.env.fs.exists(SOCKET))
        assertEquals(emptySet<String>(), fixture.listeners.listening)
        assertTrue(peer.isDestroyed)
    }

    @Test
    fun `deletes the lock before closing the pipe, so no reader finds a dead pipe`() {
        val fixture = started()
        val lockAtClose = CompletableFuture<Boolean>()
        fixture.listeners.onClose = { lockAtClose.complete(fixture.env.fs.exists(LOCK)) }

        fixture.hub.close()

        assertFalse(lockAtClose.get(5, TimeUnit.SECONDS))
    }

    @Test
    fun `deletes a hub false lock too`() {
        val fixture = startedOff()

        fixture.hub.close()

        assertEquals(emptyList<String>(), fixture.env.fs.files())
    }

    @Test
    fun `closes once, however often asked`() {
        val fixture = started()

        assertTrue(fixture.hub.close())
        assertTrue(fixture.hub.close())

        assertEquals(1, fixture.listeners.listens.size)
        assertEquals(listOf(SOCKET), fixture.listeners.closes)
        assertEquals(emptyList<String>(), fixture.env.fs.files())
    }

    @Test
    fun `never binds a pipe or writes a lock when closed right after it starts`() {
        val host = MemoryHost().apply { foldersGate = CompletableDeferred() }
        val fixture = Fixture(host = host).start()
        awaitUntil(message = "the startup task in folders") { host.foldersCalls.get() == 1 }

        assertTrue(fixture.hub.close(20_000))

        assertEquals(emptyList<String>(), fixture.listeners.listens)
        assertEquals(emptyList<String>(), fixture.env.fs.files())
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `rewrites the lock atomically on every document change`() {
        val fixture = started()
        fixture.env.fs.clearCalls()

        fixture.setDocuments("/ws/a.erd.json")
        assertEquals(listOf("/ws/a.erd.json"), fixture.lock()?.documents)
        fixture.setDocuments("/ws/a.erd.json", "/ws/b.erd.json")
        assertEquals(listOf("/ws/a.erd.json", "/ws/b.erd.json"), fixture.lock()?.documents)
        fixture.setDocuments("/ws/b.erd.json")
        assertEquals(listOf("/ws/b.erd.json"), fixture.lock()?.documents)

        val writes = fixture.env.fs.callsOf(FakeOp.WRITE_NEW_FILE).map { listOf(it[0], it[2]) }
        assertEquals(List(3) { listOf("$LOCK.tmp", LockPaths.LOCK_FILE_MODE) }, writes)
        assertEquals(List(3) { listOf("$LOCK.tmp", LOCK) }, fixture.env.fs.callsOf(FakeOp.MOVE_REPLACING))
    }

    @Test
    fun `lists each document under its real path`() {
        val env = FakeEnvironment().apply {
            fs.addFile("/real/a.erd.json")
            links["/link"] = "/real"
        }
        val fixture = started(env = env)

        fixture.setDocuments("/link/a.erd.json")

        assertEquals(listOf("/real/a.erd.json"), fixture.lock()?.documents)
    }

    @Test
    fun `resolves and only warns when the lock cannot be written, then succeeds on the next call`() {
        for (op in listOf(FakeOp.WRITE_NEW_FILE, FakeOp.MOVE_REPLACING)) {
            log.clear()
            val fixture = started()
            fixture.env.failNext(op, IOException("$op failed"))

            fixture.setDocuments("/ws/a.erd.json")
            assertEquals(listOf("could not write $LOCK"), log.texts)
            assertEquals(emptyList<String>(), fixture.lock()?.documents)

            fixture.setDocuments("/ws/a.erd.json")
            assertEquals(listOf("/ws/a.erd.json"), fixture.lock()?.documents)
            fixture.hub.close()
        }
    }

    @Test
    fun `recreates the lock directory when the user deleted it`() {
        val fixture = started()
        fixture.env.fs.deleteIfExists(LOCK)
        fixture.env.fs.deleteIfExists(SOCKET)
        fixture.env.fs.deleteIfExists(LOCK_DIR)

        fixture.setDocuments("/ws/a.erd.json")

        assertEquals(record(documents = listOf("/ws/a.erd.json")), fixture.lock())
    }

    @Test
    fun `keeps the documents and the folders in the hub false lock of a hub that failed to listen`() {
        val fixture = Fixture()
        fixture.listeners.failListenOnce()
        fixture.start()

        fixture.setDocuments("/ws/a.erd.json")
        fixture.host.roots = listOf("/ws")
        fixture.host.fireFoldersChange()
        fixture.flush()

        assertEquals(record(pipe = "", token = "", folders = listOf("/ws"), documents = listOf("/ws/a.erd.json")), fixture.lock())
    }

    @Test
    fun `writes nothing once the hub is closed`() {
        val fixture = started()
        fixture.hub.close()

        fixture.setDocuments("/ws/a.erd.json")
        fixture.documents.publish(listOf("/ws/b.erd.json")).get(5, TimeUnit.SECONDS)

        assertNull(fixture.lock())
    }

    @Test
    fun `lets go of the host on close, so a later event writes nothing`() {
        val fixture = started()
        assertEquals(2, fixture.host.subscriptions)

        fixture.hub.close()
        fixture.host.turn(false)
        fixture.host.fireFoldersChange()
        fixture.flush()

        assertEquals(0, fixture.host.subscriptions)
        assertNull(fixture.lock())
    }

    @Test
    fun `queues nothing for host events once detached, and keeps serving`() {
        val fixture = started()
        val peer = fixture.connectToLock()
        fixture.env.fs.clearCalls()

        fixture.hub.detach()
        fixture.host.turn(false)
        fixture.host.roots = listOf("/elsewhere")
        fixture.host.fireFoldersChange()
        fixture.flush()

        assertEquals(0, fixture.host.subscriptions)
        assertEquals(emptyList<Any>(), fixture.env.fs.calls)
        assertEquals(record(), fixture.lock())
        assertFalse(peer.isDestroyed)
    }

    @Test
    fun `logs an unsubscription that throws and lets go of the rest`() {
        val fixture = started()
        val failure = IllegalStateException("the bus is gone")
        fixture.host.throwOnUnsubscribe = failure

        fixture.hub.detach()

        assertEquals(0, fixture.host.subscriptions)
        assertEquals(listOf("" to failure, "" to failure), log.lines)
    }

    @Test
    fun `closes at once while the running task waits on the host, and removes the lock`() {
        val fixture = started()
        val gate = CompletableDeferred<Unit>()
        fixture.host.foldersGate = gate
        fixture.host.fireFoldersChange()
        awaitUntil(message = "the folders task suspended") { fixture.host.foldersCalls.get() == 2 }

        val begun = System.nanoTime()
        assertTrue(fixture.hub.close(20_000))
        val tookMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - begun)

        assertTrue("closed in $tookMs ms, without waiting out the bound", tookMs < 10_000)
        assertNull(fixture.lock())
        assertEquals(listOf(SOCKET), fixture.listeners.closes)
        assertFalse("the cancelled call never answered", gate.isCompleted)
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `gives up on a lock write that outlives the close bound, and deletes it again once it lands`() {
        val fixture = started()
        val write = fixture.env.hold(FakeOp.WRITE_NEW_FILE)
        val setting = fixture.hub.setDocuments(listOf("/ws/a.erd.json"))
        write.awaitEntered()

        assertFalse(fixture.hub.close(200))

        val (text, detail) = log.lines.single()
        assertEquals("could not close the document hub", text)
        assertTrue(detail is TimeoutException)
        assertNull(fixture.lock())
        assertEquals(emptySet<String>(), fixture.listeners.listening)
        assertFalse(fixture.env.fs.exists(SOCKET))
        write.release()
        setting.get(5, TimeUnit.SECONDS)
        assertNull(fixture.lock())
        assertFalse(fixture.env.fs.exists("$LOCK.tmp"))
    }

    @Test
    fun `stops a startup that outlived the close bound in a file call before it listens`() {
        val fixture = Fixture()
        val sweep = fixture.env.hold(FakeOp.LIST_NAMES)
        fixture.start()
        sweep.awaitEntered()

        assertFalse(fixture.hub.close(200))
        sweep.release()
        awaitUntil(message = "the startup read the folders") { fixture.host.foldersCalls.get() == 1 }
        Thread.sleep(300)

        assertEquals("cancelled by the close, it never listens", emptyList<String>(), fixture.listeners.listens)
        assertNull(fixture.lock())
        assertEquals(listOf("could not close the document hub"), log.texts)
    }

    @Test
    fun `stops a pipe once when a late close and the task it gave up on both let go of it`() {
        val fixture = startedOff()
        val write = fixture.env.hold(FakeOp.WRITE_NEW_FILE)
        fixture.host.turn(true)
        write.awaitEntered()
        fixture.env.fs.clearCalls()

        assertFalse("the lock write after the listen holds the close", fixture.hub.close(200))
        assertEquals(listOf(SOCKET), fixture.listeners.closes)
        write.release()
        awaitUntil(message = "the landed lock deleted again") { fixture.removedSync().size >= 7 }
        fixture.hub.flushed().get(5, TimeUnit.SECONDS)

        // releaseSync's four, close's pipe, then the landed lock and its temp; the task's own stop finds the pipe stopped.
        assertEquals(listOf(LOCK, "$LOCK.tmp", SOCKET, TMP_SOCKET, SOCKET, LOCK, "$LOCK.tmp"), fixture.removedSync())
        assertEquals(listOf(SOCKET), fixture.listeners.closes)
        assertNull(fixture.lock())
    }

    @Test
    fun `deletes the lock and the socket on releaseSync before it returns, and nothing writes the lock after`() {
        val fixture = started()

        fixture.hub.releaseSync()

        assertFalse(fixture.env.fs.exists(LOCK))
        assertFalse(fixture.env.fs.exists(SOCKET))
        assertEquals(0, fixture.host.subscriptions)
        fixture.setDocuments("/ws/a.erd.json")
        fixture.documents.publish(listOf("/ws/b.erd.json")).get(5, TimeUnit.SECONDS)
        fixture.host.turn(false)
        fixture.flush()
        assertNull(fixture.lock())
    }

    @Test
    fun `deletes again a lock whose write was already on its way to disk at releaseSync`() {
        val fixture = started()
        val write = fixture.env.hold(FakeOp.WRITE_NEW_FILE)
        val writing = fixture.hub.setDocuments(listOf("/ws/a.erd.json"))
        write.awaitEntered()

        fixture.hub.releaseSync()
        write.release()
        writing.get(5, TimeUnit.SECONDS)

        assertEquals(listOf("$LOCK.tmp", LOCK), fixture.env.fs.callsOf(FakeOp.MOVE_REPLACING).last())
        assertNull(fixture.lock())
        assertFalse(fixture.env.fs.exists("$LOCK.tmp"))
    }

    @Test
    fun `deletes the socket under the temp directory of a home too long for one`() {
        val env = FakeEnvironment(homeDir = LONG_HOME).apply { fs.addDir("/tmp") }
        val fixture = started(env = env)
        assertTrue(env.fs.exists(TMP_SOCKET))

        fixture.hub.releaseSync()

        assertFalse(env.fs.exists(TMP_SOCKET))
        assertNull(fixture.lock())
    }

    @Test
    fun `tears down a listen still in flight at releaseSync once it returns, rather than let it write the lock`() {
        val fixture = startedOff()
        val bind = fixture.listeners.holdListen()
        fixture.host.turn(true)
        bind.awaitEntered()

        fixture.hub.releaseSync()
        bind.release()
        awaitUntil(message = "the listen torn down") { fixture.listeners.closes.isNotEmpty() }
        // Before the bind, by releaseSync, and once the listen that landed stopped.
        awaitUntil(message = "its socket deleted") { fixture.removedSync().count { it == SOCKET } == 3 }

        assertEquals(listOf(SOCKET), fixture.listeners.closes)
        assertEquals(emptySet<String>(), fixture.listeners.listening)
        assertFalse(fixture.env.fs.exists(SOCKET))
        assertNull(fixture.lock())
    }

    @Test
    fun `releases once, and a close after it still stops the pipe`() {
        val fixture = started()
        val peer = fixture.connectToLock()
        fixture.env.fs.clearCalls()

        fixture.hub.releaseSync()
        fixture.hub.releaseSync()
        assertTrue(fixture.hub.close())

        // releaseSync's lock, temp and both sockets, then close's delete of the pipe it stopped.
        assertEquals(listOf(LOCK, "$LOCK.tmp", SOCKET, TMP_SOCKET, SOCKET), fixture.removedSync())
        assertTrue(peer.isDestroyed)
        assertEquals(emptySet<String>(), fixture.listeners.listening)
        assertEquals(emptyList<String>(), fixture.env.fs.files())
    }

    @Test
    fun `deletes no socket file for the named pipe of win32`() {
        val fixture = started(env = FakeEnvironment(platform = HubPlatform.WIN32))
        assertEquals(record(pipe = WIN32_PIPE), fixture.lock())

        fixture.hub.releaseSync()

        assertEquals(listOf(LOCK, "$LOCK.tmp"), fixture.removedSync())
        assertNull(fixture.lock())
    }

    @Test
    fun `listens under tmp when the home is too long, names that pipe in the lock and keeps the lock in the home`() {
        val env = FakeEnvironment(homeDir = LONG_HOME).apply { fs.addDir("/tmp") }

        val fixture = started(env = env)

        assertEquals(listOf(TMP_SOCKET), fixture.listeners.listens)
        assertEquals(LockPaths.lockFilePath(LONG_HOME, 4242), fixture.lockPath)
        assertEquals(record(pipe = TMP_SOCKET), fixture.lock())
        assertFalse(env.fs.exists(LockPaths.pipePath(LONG_HOME, 4242, HubPlatform.LINUX)))

        fixture.hub.close()
        assertFalse(env.fs.exists(TMP_SOCKET))
        assertNull(fixture.lock())
    }

    @Test
    fun `serves the named pipe on win32 whatever the home, and deletes no socket file for it`() {
        val env = FakeEnvironment(homeDir = LONG_HOME, platform = HubPlatform.WIN32)
        val fixture = started(env = env)

        assertEquals(record(pipe = WIN32_PIPE), fixture.lock())
        fixture.hub.close()

        assertEquals(emptyList<Any?>(), fixture.removedSync())
        assertTrue(env.fs.callsOf(FakeOp.DELETE_IF_EXISTS).none { it.single() == WIN32_PIPE })
        assertEquals(emptySet<String>(), fixture.listeners.listening)
    }

    @Test
    fun `never listens and writes only a hub false lock when no socket path fits at all`() {
        val tmp = "/" + "t".repeat(100)
        val env = FakeEnvironment(homeDir = LONG_HOME, tmpDir = tmp)

        val fixture = started(env = env)

        assertEquals(emptyList<String>(), fixture.listeners.listens)
        assertEquals(record(pipe = "", token = ""), fixture.lock())
        assertEquals(listOf("neither ${LockPaths.lockDirPath(LONG_HOME)} nor $tmp leaves room for a socket path"), log.texts)
    }

    @Test
    fun `authorizes against the scope the lock lists, and a request mid-write sees the new scope whole`() {
        val env = FakeEnvironment().apply {
            fs.addDir("/a")
            fs.addDir("/b")
        }
        val fixture = started(MemoryHost(roots = listOf("/a")), env)
        fixture.setDocuments("/d.erd.json")
        assertEquals("/a/x.erd.json", fixture.hub.authorize("/a/x.erd.json"))
        val write = env.hold(FakeOp.WRITE_NEW_FILE)

        fixture.host.roots = listOf("/b")
        fixture.host.fireFoldersChange()
        write.awaitEntered()

        assertEquals(AuthScope(listOf("/b"), listOf("/d.erd.json")), fixture.hub.scope)
        assertEquals("/b/x.erd.json", fixture.hub.authorize("/b/x.erd.json"))
        assertEquals("/d.erd.json", fixture.hub.authorize("/d.erd.json"))
        val refused = assertThrows(HubRequestError::class.java) { fixture.hub.authorize("/a/x.erd.json") }
        assertEquals(HubErrorCode.OUTSIDE_WORKSPACE, refused.code)
        write.release()
        fixture.flush()
    }

    @Test
    fun `hands the hook every scope it writes, in order, on the registry thread once the lock lists it`() {
        val env = FakeEnvironment().apply { fs.addDir("/a") }
        val fixture = started(MemoryHost(roots = listOf("/a")), env)

        fixture.setDocuments("/ws/a.erd.json")
        fixture.host.roots = emptyList()
        fixture.host.fireFoldersChange()
        fixture.flush()
        awaitUntil(message = "three scopes") { fixture.hooks.size == 3 }

        val scopes = listOf(
            AuthScope(listOf("/a"), emptyList()),
            AuthScope(listOf("/a"), listOf("/ws/a.erd.json")),
            AuthScope(emptyList(), listOf("/ws/a.erd.json")),
        )
        assertEquals("the published documents' write, then each change", scopes, fixture.hooks.map { it.scope })
        assertEquals(scopes, fixture.hooks.map { AuthScope(it.lock!!.workspaceFolders, it.lock.documents) })
        assertTrue(fixture.hooks.toString(), fixture.hooks.all { it.thread.startsWith("${threads.namePrefix}-registry") })
    }

    @Test
    fun `starts once, and not at all once closed`() {
        val fixture = started()
        fixture.hub.start()
        fixture.flush()
        assertEquals(2, fixture.host.subscriptions)
        assertEquals(1, fixture.listeners.listens.size)

        val closed = Fixture()
        closed.hub.close()
        closed.hub.start()

        assertEquals(0, closed.host.subscriptions)
        assertNull(closed.documents.publisher)
    }

    private companion object {
        const val LOCK_DIR = "/home/user/.erd-editor/ide"
        const val LOCK = "$LOCK_DIR/4242.json"
        const val SOCKET = "$LOCK_DIR/4242.sock"
        const val TMP_SOCKET = "/tmp/erd-editor-ide-4242.sock"
        const val WIN32_PIPE = "\\\\.\\pipe\\erd-editor-ide-4242"

        /** A home whose socket path is one byte past the limit. */
        val LONG_HOME = "/" + "h".repeat(LockPaths.MAX_PIPE_PATH_BYTES + 1 - "/.erd-editor/ide/4242.sock".length - 1)

        val TIMINGS = HubTimings(publishWaitMs = 400, closeBoundMs = 2_000)
    }
}
