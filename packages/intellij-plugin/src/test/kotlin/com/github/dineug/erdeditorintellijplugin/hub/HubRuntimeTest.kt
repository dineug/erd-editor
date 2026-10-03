package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.document.ProjectTrust
import com.github.dineug.erdeditorintellijplugin.hub.server.HubNotification
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeDocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeIdeFacade
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeListenerFactory
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeOp
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeView
import com.github.dineug.erdeditorintellijplugin.hub.testing.MemoryChannel
import com.github.dineug.erdeditorintellijplugin.hub.testing.MemoryHost
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingConnection
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingHooks
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/**
 * HubRuntime over the fake machine and listener, as Obsidian's runtime and lifecycle suites hold
 * theirs: the hub it composes with the registry, a shutdown in order (peers told and drained, then
 * the lock and the pipe, then the threads), every bound of it, the release hook, and no hub at all.
 */
class HubRuntimeTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    @get:Rule
    val testThreads = TestThreads()

    private val log = RecordingLog()
    private val runtimes = CopyOnWriteArrayList<HubRuntime>()

    @After
    fun tearDown() {
        runtimes.forEach(HubRuntime::dispose)
    }

    /** One runtime over a fake machine whose only folder is WS, or over none when env is null; not started. */
    private inner class Fixture(
        val env: FakeEnvironment? = machine(),
        val listeners: FakeListenerFactory? = env?.let(::FakeListenerFactory),
        timings: HubTimings = TIMINGS,
    ) {
        val host = MemoryHost(ide = "intellij", roots = listOf(WS))
        val hooks = RecordingHooks()
        val ide = FakeIdeFacade().apply { projects = listOf(ProjectTrust(listOf(WS), trusted = true)) }
        val threads = testThreads.create(log)
        val runtime = HubRuntime(
            env, host, ide,
            listeners = { _, _ -> checkNotNull(listeners) },
            hooks = hooks,
            log = log,
            platform = HubPlatform.LINUX,
            timings = timings,
            threads = threads,
        ).also(runtimes::add)

        /** Started, with the lock serving. */
        fun started(): Fixture = apply {
            runtime.start()
            awaitUntil(message = "the lock serves") { lock()?.hub == true }
        }

        fun lock(): LockRecord? = env?.fs?.textOf(LOCK)?.let { checkNotNull(parseLock(it)) { "not a lock: $it" } }

        /** A peer through the pipe the lock names, past hello, joined to A from disk. */
        fun joinedPeer(): MemoryChannel {
            val lock = checkNotNull(lock())
            return checkNotNull(listeners).connect(lock.pipe).apply {
                send(hello(lock.token), join(2, A))
                awaitUntil(message = "the join answered") { received.size == 2 }
                assertEquals(JOINED_FROM_DISK, received[1])
            }
        }
    }

    @Test
    fun `starts the hub with a release hook, once, and serves a peer through the registry`() {
        val fixture = Fixture().started()
        fixture.joinedPeer()

        val lock = checkNotNull(fixture.lock())
        assertEquals(listOf(WS), lock.workspaceFolders)
        assertEquals("intellij", lock.ide)
        assertEquals(listOf("${fixture.threads.namePrefix}-release"), fixture.hooks.active.map { it.name })

        fixture.runtime.start()
        assertEquals(1, fixture.hooks.added.size)
        assertEquals(listOf(SOCKET), fixture.listeners?.listens)
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `closes a peer's paths once the lock's folders no longer hold them`() {
        val fixture = Fixture().started()
        val peer = fixture.joinedPeer()

        fixture.host.roots = emptyList()
        fixture.host.fireFoldersChange()

        awaitUntil(message = "the peer was told and its stream ended") { peer.isOutputShutdown }
        assertEquals(CLOSED_A, peer.received.drop(2).single())
        assertEquals(emptyList<String>(), checkNotNull(fixture.lock()).workspaceFolders)
    }

    @Test
    fun `tells every peer documentClosed and lets that frame out before the pipe closes`() {
        val fixture = Fixture().started()
        val peer = fixture.joinedPeer()
        val atClose = CopyOnWriteArrayList<List<String>>()
        checkNotNull(fixture.listeners).onClose = { atClose += peer.received }

        fixture.runtime.dispose()

        assertEquals(CLOSED_A, atClose.single().drop(2).single())
        assertTrue(peer.isDestroyed)
        assertNull(fixture.lock())
        assertFalse(checkNotNull(fixture.env).fs.exists(SOCKET))
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `leaves no hub thread and no shutdown hook behind once disposed, however often`() {
        val fixture = Fixture().started()
        fixture.joinedPeer()
        val hook = fixture.hooks.active.single()

        fixture.runtime.dispose()
        fixture.runtime.dispose()

        assertEquals(emptyList<Thread>(), testThreads.liveThreads())
        assertEquals(emptyList<Thread>(), fixture.hooks.active)
        assertEquals(listOf(hook), fixture.hooks.removed)
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `returns within its bounds while a lock write hangs, and deletes the lock that write lands later`() {
        val fixture = Fixture().started()
        val env = checkNotNull(fixture.env)
        val rename = env.hold(FakeOp.MOVE_REPLACING)
        fixture.host.fireFoldersChange()
        rename.awaitEntered()

        val tookMs = measureMs { fixture.runtime.dispose() }

        assertTrue("disposed in $tookMs ms", tookMs < DISPOSE_BOUND_MS + MARGIN_MS)
        assertNull(fixture.lock())
        assertFalse(env.fs.exists(SOCKET))
        assertEquals(listOf(CLOSE_FAILED, CLOSE_FAILED), log.texts)
        assertTrue(log.lines.toString(), log.lines.all { it.second is TimeoutException })
        assertEquals(emptyList<Thread>(), fixture.hooks.active)

        rename.release()
        awaitUntil(message = "the thread the write held ended") { testThreads.liveThreads().isEmpty() }
        assertNull("the late rename is deleted again", fixture.lock())
        assertFalse(env.fs.exists("$LOCK.tmp"))
    }

    @Test
    fun `lets a second runtime on the same machine write a fresh lock the first never deletes`() {
        val env = machine()
        val listeners = FakeListenerFactory(env)
        val first = Fixture(env, listeners).started()
        assertEquals("token-1", first.lock()?.token)
        first.runtime.dispose()
        assertNull(first.lock())

        val second = Fixture(env, listeners).started()
        first.runtime.start()
        first.runtime.shutdownPeers()
        first.runtime.dispose()
        second.joinedPeer()

        val lock = checkNotNull(second.lock())
        assertEquals("token-2", lock.token)
        assertTrue(lock.hub)
        assertEquals(emptyList<Thread>(), first.hooks.active)
        assertEquals(1, second.hooks.active.size)
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `runs the registry without a hub, a lock or a hook when there is no machine`() {
        val fixture = Fixture(env = null)
        assertNull(fixture.runtime.hub)
        fixture.runtime.start()
        val file = FakeDocumentFile(A)
        val view = FakeView()

        fixture.runtime.registry.post {
            addView(file, view)
            onViewReady(file, view, "{}")
        }
        awaitUntil(message = "the view readied") { view.initialValues == listOf("{}") }
        val listedMs = measureMs { runBlocking { fixture.runtime.registry.call { awaitListed(file, 20_000) } } }
        fixture.runtime.shutdownPeers()
        fixture.runtime.dispose()

        assertTrue("no lock to wait for, yet waited $listedMs ms", listedMs < 5_000)
        assertEquals(emptyList<Thread>(), fixture.hooks.added)
        assertEquals(0, fixture.host.subscriptions)
        assertEquals(emptyList<Thread>(), testThreads.liveThreads())
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `shuts the peers down once, lets go of the host, then guards with a hub false lock until dispose`() {
        val fixture = Fixture().started()
        val peer = fixture.joinedPeer()
        val lock = checkNotNull(fixture.lock())

        fixture.runtime.shutdownPeers()
        assertEquals(CLOSED_A, peer.received.drop(2).single())
        assertEquals(0, fixture.host.subscriptions)
        awaitUntil(message = "the lock turns hub false") { fixture.lock()?.hub == false }
        assertEquals(lock.copy(pipe = "", token = "", hub = false), fixture.lock())
        awaitUntil(message = "the peer's connection ends") { peer.isDestroyed }

        fixture.host.roots = emptyList()
        fixture.host.fireFoldersChange()
        fixture.host.fireEnabledChange()
        fixture.runtime.shutdownPeers()
        fixture.runtime.registry.callBlocking(5_000) {}
        assertEquals("no host event serves again", lock.copy(pipe = "", token = "", hub = false), fixture.lock())

        fixture.runtime.dispose()
        assertNull(fixture.lock())
    }

    @Test
    fun `closes within its bounds while the host's folders wait in a read action`() {
        val fixture = Fixture().started()
        val gate = CompletableDeferred<Unit>()
        fixture.host.foldersGate = gate
        fixture.host.fireFoldersChange()
        awaitUntil(message = "the folders task suspended") { fixture.host.foldersCalls.get() == 2 }

        val tookMs = measureMs { fixture.runtime.dispose() }

        assertTrue("disposed in $tookMs ms", tookMs < DISPOSE_BOUND_MS + MARGIN_MS)
        assertEquals(emptyList<String>(), log.texts)
        assertEquals(emptyList<Thread>(), testThreads.liveThreads())
        assertNull(fixture.lock())
        assertFalse("the cancelled call never answered", gate.isCompleted)
        gate.complete(Unit)
    }

    @Test
    fun `logs a throwing registry step and a failing job as request failed`() {
        val fixture = Fixture(env = null)

        fixture.runtime.registry.post { throw IllegalStateException("a step") }
        fixture.runtime.threads.scope.launch { throw IllegalStateException("a job") }

        awaitUntil(message = "both logged") { log.lines.size == 2 }
        assertEquals(listOf("request failed", "request failed"), log.texts)
        assertEquals(setOf("a step", "a job"), log.lines.map { (it.second as Throwable).message }.toSet())
    }

    @Test
    fun `deletes the lock and the socket from its shutdown hook, and nothing else`() {
        val fixture = Fixture().started()
        val peer = fixture.joinedPeer()

        fixture.hooks.active.single().run()

        assertNull(fixture.lock())
        assertFalse(checkNotNull(fixture.env).fs.exists(SOCKET))
        assertEquals("no peer was told anything", 2, peer.received.size)
        assertEquals(setOf(SOCKET), fixture.listeners?.listening)
        fixture.runtime.dispose()
        assertNull(fixture.lock())
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `adds no hook and starts nothing once disposed`() {
        val fixture = Fixture()

        fixture.runtime.dispose()
        fixture.runtime.start()

        assertEquals(emptyList<Thread>(), fixture.hooks.added)
        assertNull(fixture.lock())
        assertEquals(emptyList<String>(), fixture.listeners?.listens)
    }

    @Test
    fun `starts no hub once the JVM refuses a new shutdown hook`() {
        val fixture = Fixture()
        fixture.hooks.throwOnAdd = IllegalStateException("Shutdown in progress")

        fixture.runtime.start()
        fixture.runtime.dispose()

        assertEquals(emptyList<Thread>(), fixture.hooks.added)
        assertEquals(emptyList<Thread>(), fixture.hooks.removed)
        assertNull(fixture.lock())
        assertEquals(emptyList<String>(), fixture.listeners?.listens)
        assertEquals(emptyList<Thread>(), testThreads.liveThreads())
    }

    @Test
    fun `shuts the peers down all the same when a drain fails or is cancelled`() {
        val fixture = Fixture().started()
        val failed = RecordingConnection(id = 101).apply {
            drained = CompletableFuture<Unit>().apply { completeExceptionally(IllegalStateException("gone")) }
        }
        val cancelled = RecordingConnection(id = 102).apply {
            drained = CompletableFuture<Unit>().apply { cancel(false) }
        }
        for (connection in listOf(failed, cancelled)) {
            assertEquals(true, fixture.runtime.registry.callBlocking(5_000) { track(connection, A) })
        }

        fixture.runtime.shutdownPeers()
        fixture.runtime.dispose()

        for (connection in listOf(failed, cancelled)) {
            assertEquals(listOf(A), connection.notifications.map { (it as HubNotification.DocumentClosed).path })
        }
        assertNull(fixture.lock())
    }

    @Test
    fun `disposes all the same when the JVM refuses to remove its hook`() {
        val fixture = Fixture().started()
        fixture.hooks.throwOnRemove = IllegalStateException("Shutdown in progress")

        fixture.runtime.dispose()

        assertEquals(1, fixture.hooks.removed.size)
        assertNull(fixture.lock())
        assertEquals(emptyList<Thread>(), testThreads.liveThreads())
        assertEquals(emptyList<String>(), log.texts)
    }

    @Test
    fun `stops waiting at the drain cap for a peer that reads nothing`() {
        val fixture = Fixture().started()
        val peer = fixture.joinedPeer()
        val release = peer.hold()

        val tookMs = measureMs { fixture.runtime.shutdownPeers() }

        assertTrue("shut the peers down in $tookMs ms", tookMs < TIMINGS.drainCapMs + MARGIN_MS)
        assertTrue("the documentClosed write still waits", peer.isWriteBlocked)
        fixture.runtime.dispose()
        assertTrue(peer.isDestroyed)
        release()
    }

    @Test
    fun `stops waiting for the drain when interrupted, and keeps the interrupt`() {
        val fixture = Fixture(timings = TIMINGS.copy(drainCapMs = 20_000)).started()
        val peer = fixture.joinedPeer()
        val release = peer.hold()
        val interrupted = CompletableFuture<Boolean>()
        val caller = Thread {
            fixture.runtime.shutdownPeers()
            interrupted.complete(Thread.currentThread().isInterrupted)
        }

        caller.start()
        awaitUntil(message = "the caller waits for the drain") {
            peer.isWriteBlocked && caller.state == Thread.State.TIMED_WAITING &&
                caller.stackTrace.any { it.className == CompletableFuture::class.java.name }
        }
        caller.interrupt()

        assertTrue(interrupted.get(5, TimeUnit.SECONDS))
        release()
    }

    @Test
    fun `gives up telling the peers when the registry does not answer within its bound`() {
        val fixture = Fixture().started()
        val peer = fixture.joinedPeer()
        val busy = CountDownLatch(1)
        fixture.runtime.registry.post { busy.await(10, TimeUnit.SECONDS) }

        val tookMs = measureMs { fixture.runtime.shutdownPeers() }

        assertTrue("shut the peers down in $tookMs ms", tookMs < TIMINGS.registryCallBoundMs + MARGIN_MS)
        assertEquals(2, peer.received.size)
        busy.countDown()
        // The shutdown given up on still runs once the registry is free, and the hub retires right
        // behind it: the connection retiring destroys may take that late documentClosed with it.
        awaitUntil(message = "the shutdown ran behind the busy step") { fixture.runtime.registry.isShutDown }
        awaitUntil(message = "the hub retired") { fixture.lock()?.hub == false }
        assertTrue("got ${peer.received}", peer.received.drop(2).all { it == CLOSED_A })
    }

    private fun measureMs(block: () -> Unit): Long {
        val begun = System.nanoTime()
        block()
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - begun)
    }

    private companion object {
        const val WS = "/ws"
        const val A = "$WS/a.erd.json"
        const val LOCK = "/home/user/.erd-editor/ide/4242.json"
        const val SOCKET = "/home/user/.erd-editor/ide/4242.sock"
        const val CLOSE_FAILED = "could not close the document hub"
        const val CLOSED_A = """{"method":"documentClosed","params":{"path":"$A"}}"""
        const val JOINED_FROM_DISK =
            """{"id":2,"ok":true,"method":"join","result":{"initialValue":"{\"on\":\"disk\"}","snapshotVersion":0,"readonly":false}}"""

        val TIMINGS = HubTimings(registryCallBoundMs = 300, drainCapMs = 300, closeBoundMs = 300, threadJoinBoundMs = 300)
        val DISPOSE_BOUND_MS =
            TIMINGS.registryCallBoundMs + TIMINGS.drainCapMs + TIMINGS.closeBoundMs + TIMINGS.threadJoinBoundMs

        /** Room for a loaded runner; the bounds are what keep dispose from hanging. */
        const val MARGIN_MS = 2_000L

        /** A machine whose one folder holds A. */
        fun machine() = FakeEnvironment().apply {
            fs.addDir(WS)
            fs.addFile(A, """{"on":"disk"}""")
        }

        fun hello(token: String) =
            """{"id":1,"method":"hello","params":{"token":"$token","protocolVersion":1,"client":"spec"}}"""

        fun join(id: Int, path: String) = """{"id":$id,"method":"join","params":{"path":"$path"}}"""
    }
}
