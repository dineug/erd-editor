package com.github.dineug.erdeditorintellijplugin.hub.server

import com.github.dineug.erdeditorintellijplugin.hub.AuthScope
import com.github.dineug.erdeditorintellijplugin.hub.Authz
import com.github.dineug.erdeditorintellijplugin.hub.HUB_PROTOCOL_VERSION
import com.github.dineug.erdeditorintellijplugin.hub.HubEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.LockFile
import com.github.dineug.erdeditorintellijplugin.hub.LockPaths
import com.github.dineug.erdeditorintellijplugin.hub.LockRecord
import com.github.dineug.erdeditorintellijplugin.hub.rethrowIfCancellation
import com.github.dineug.erdeditorintellijplugin.hub.transport.HubListener
import com.github.dineug.erdeditorintellijplugin.hub.transport.HubListenerFactory
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Serves this IDE's documents over one pipe that its lock file advertises, as packages/agent-hub-host's
 * DocumentHub.ts: every state change runs on one StateQueue, so the lock on disk follows the order of
 * the host's enabled, folder and document events. It listens before a lock names the pipe, rewrites
 * the lock before the pipe goes, and a hub that cannot serve writes hub false, never no lock at all.
 */
class DocumentHub(
    private val env: HubEnvironment,
    private val host: HubHost,
    private val documents: HubDocuments,
    private val handler: HubHandler,
    private val listeners: HubListenerFactory,
    private val threads: HubThreads,
    private val log: HubLog,
    private val timings: HubTimings = HubTimings(),
    private val onScopeChanged: (AuthScope) -> Unit = {},
) {
    /** A listen: its pipe, the token the lock names for it, and the connections it accepted. */
    private class Serving(
        val pipe: String,
        val token: String,
        private val listener: HubListener,
        private val connections: Set<ServedConnection>,
    ) {
        private val stopped = AtomicBoolean()

        /** Stops accepting and destroys every connection, once: a late listen and close may both try. */
        fun stop(): Boolean {
            if (!stopped.compareAndSet(false, true)) return false
            listener.close()
            connections.forEach(ServedConnection::destroyNow)
            return true
        }
    }

    private val authz = Authz(env)
    private val lockFile = LockFile(env, log)
    private val queue = StateQueue(threads, log)
    private val connectionIds = AtomicInteger()
    private val started = AtomicBoolean()
    private val releasing = AtomicBoolean()
    private val closeLock = Any()
    private var closeOutcome: Boolean? = null
    private val subscriptionLock = Any()
    private val subscriptions = ArrayList<AutoCloseable>()
    private var detached = false

    /**
     * The folders and documents the lock lists, realpathed: replaced by the queue right before each
     * lock write, and read once per request by authorize, so a request sees the old scope or the new
     * one, never a mix.
     */
    @Volatile
    var scope: AuthScope = AuthScope.EMPTY
        private set

    /** Null until the host was first asked; queue tasks only. */
    private var enabled: Boolean? = null

    @Volatile
    private var serving: Serving? = null

    /** Set by releaseSync: the lock is gone, and no write may bring it back. */
    @Volatile
    private var released = false

    /** Set by retire: the hub serves no more, whatever the host asks. */
    @Volatile
    private var retired = false

    /** Subscribes to the host, then sweeps dead locks, reads the folders and moves to the state the host asks for. */
    fun start() {
        if (queue.closed || !started.compareAndSet(false, true)) return
        subscribe(host.onEnabledChange { queue.enqueueListen(::apply) })
        subscribe(host.onFoldersChange { queue.enqueue(::updateFolders) })
        queue.enqueueListen {
            lockFile.cleanStale()
            scope = AuthScope(realFolders(), scope.documents)
            apply()
        }
        // The registry publishes what it holds at once; that write queues behind the startup task,
        // a listen ahead of it, so the publish returns without waiting for the bind.
        documents.setPublisher(HubPublisher(::publish))
    }

    /**
     * What the registry publishes the open documents through. The write always queues in order; the
     * caller waits for it with no listen ahead and for publishWaitMs at most, so neither a hub coming
     * up nor a stalled task holds an editor opening. Never fails.
     */
    fun publish(documents: List<String>): CompletableFuture<Unit> {
        val written = setDocuments(documents)
        if (queue.listensAhead.get() > 0) return CompletableFuture.completedFuture(Unit)

        val published = CompletableFuture<Unit>()
        // The write and the wait race; the first to settle decides, so a caller sees the warning first.
        val decided = AtomicBoolean()
        val timeout = threads.schedule(timings.publishWaitMs) {
            if (decided.compareAndSet(false, true)) {
                log.warn("the lock did not list the open documents within 1 second; the editor opens without waiting for it")
                published.complete(Unit)
            }
        } ?: return CompletableFuture.completedFuture(Unit)
        written.whenComplete { _, _ ->
            if (decided.compareAndSet(false, true)) {
                timeout.cancel(false)
                published.complete(Unit)
            }
        }
        return published
    }

    /** Replaces the documents the lock lists, in one atomic rewrite; completes once written or refused, never exceptionally. */
    fun setDocuments(documents: List<String>): CompletableFuture<Unit> = queue.enqueue {
        val next = AuthScope(scope.folders, documents.map(authz::realpathOrSelf))
        scope = next
        try {
            writeLock()
        } finally {
            threads.post { onScopeChanged(next) }
        }
    }

    /** The real path a peer's path names, or HubRequestError(outsideWorkspace); blocking. */
    fun authorize(target: String): String = authz.authorizePath(scope, target)

    /** Lets go of the host's events, so a later folder or enabled change queues nothing. */
    fun detach() {
        val ending = synchronized(subscriptionLock) {
            detached = true
            subscriptions.toList().also { subscriptions.clear() }
        }
        for (subscription in ending) {
            try {
                subscription.close()
            } catch (e: Exception) {
                e.rethrowIfCancellation()
                log.warn("", e)
            }
        }
    }

    /**
     * Stops the hub within boundMs: skips what is queued, cancels the running task, whose suspended
     * host call unwinds at once, and waits for it. In time, the lock goes; late, releaseSync's
     * semantics delete it now and a late write deletes it again. Then the pipe closes. Never throws.
     * @return false when the running task outlived the bound.
     */
    fun close(boundMs: Long = timings.closeBoundMs): Boolean = synchronized(closeLock) {
        closeOutcome?.let { return it }
        queue.closed = true
        detach()
        queue.cancelRunning()
        val late = awaitRunning(boundMs)
        if (late == null) {
            lockFile.remove()
        } else {
            releaseSync()
            log.warn("could not close the document hub", late)
        }
        // Read only now: a listen that lands later stops itself, having found the queue closed.
        val previous = serving
        serving = null
        stopServing(previous)
        (late == null).also { closeOutcome = it }
    }

    /**
     * Deletes the lock and both socket paths before it returns, for a process going down without
     * awaiting close; nothing writes the lock after it. Leaves the listener to close. Idempotent.
     */
    fun releaseSync() {
        if (!releasing.compareAndSet(false, true)) return
        queue.closed = true
        released = true
        detach()
        lockFile.removeSync()
        for (socket in LockPaths.socketFilePaths(env.homeDir, env.tmpDir, env.pid, env.platform)) {
            env.removeFileSync(socket)
        }
    }

    /**
     * Stops serving for good while the IDE exits: the pipe closes and the lock turns hub false, so
     * the paths of the editors still open stay guarded until close deletes the lock.
     */
    fun retire(): CompletableFuture<Unit> {
        retired = true
        return queue.enqueue(::apply)
    }

    /** Completes once every state change queued before it ran; for the suites. */
    internal fun flushed(): CompletableFuture<Unit> = queue.enqueue {}

    private fun subscribe(subscription: AutoCloseable) {
        val keep = synchronized(subscriptionLock) { !detached && subscriptions.add(subscription) }
        if (!keep) subscription.close()
    }

    /** null in time, else why the running task was given up on. */
    private fun awaitRunning(boundMs: Long): TimeoutException? {
        val running = queue.running() ?: return null
        return try {
            running.get(boundMs, TimeUnit.MILLISECONDS)
            null
        } catch (e: TimeoutException) {
            TimeoutException("the task changing the lock did not end within $boundMs ms")
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            TimeoutException("interrupted while the task changing the lock ran")
        }
    }

    private suspend fun realFolders(): List<String> = host.folders().map(authz::realpathOrSelf)

    /**
     * Moves to the state the host asks for. Enabling listens before the lock names the pipe;
     * disabling rewrites the lock before the pipe goes. A hub that fails to serve falls back to hub
     * false. A close that cancelled this task stops it before it listens.
     */
    private suspend fun apply() {
        currentCoroutineContext().ensureActive()
        val want = !retired && host.isEnabled()
        if (want == enabled && want == (serving != null)) return

        enabled = want
        if (!want) {
            val previous = serving
            serving = null
            writeLock()
            stopServing(previous)
            return
        }

        val next = listen()
        if (next != null) {
            if (queue.closed) {
                // close or releaseSync came while it bound: it never serves, and writes no lock.
                stopServing(next)
                return
            }
            serving = next
            if (writeLock()) return
            serving = null
            stopServing(next)
        }
        writeLock()
    }

    private suspend fun updateFolders() {
        val next = AuthScope(realFolders(), scope.documents)
        scope = next
        try {
            writeLock()
        } finally {
            threads.post { onScopeChanged(next) }
        }
    }

    private fun listen(): Serving? {
        val pipe = LockPaths.choosePipePath(env.homeDir, env.tmpDir, env.pid, env.platform)
        if (pipe == null) {
            log.warn("neither ${lockFile.lockDir} nor ${env.tmpDir} leaves room for a socket path")
            return null
        }
        val token = env.randomToken()
        return try {
            env.fs.makeDirectories(lockFile.lockDir, LockPaths.LOCK_DIR_MODE)
            // A dead process with this pid can have left a socket file here, and so can an earlier
            // hub of this very process, a reload or a re-enable; the JDK refuses to bind over it.
            if (!env.platform.isWindows) env.removeFileSync(pipe)
            val options = ServeOptions(
                token, host.ide, env.version, handler, ::authorize, connectionIds::incrementAndGet, threads, log,
            )
            val connections = ConcurrentHashMap.newKeySet<ServedConnection>()
            val listener = listeners.listen(pipe) { channel ->
                val connection = serveConnection(channel, options)
                connections += connection
                connection.finished.whenComplete { _, _ -> connections -= connection }
                connection.start()
            }
            Serving(pipe, token, listener, connections)
        } catch (e: Exception) {
            e.rethrowIfCancellation()
            log.warn("could not listen on $pipe", e)
            null
        } catch (e: LinkageError) {
            // A named pipe's JNA natives that fail to load still leave the hub false lock guarding.
            log.warn("could not listen on $pipe", e)
            null
        }
    }

    /** Closes the listener and every connection, then deletes the socket file; a named pipe is no file. */
    private fun stopServing(target: Serving?) {
        if (target == null || !target.stop()) return
        if (!env.platform.isWindows) env.removeFileSync(target.pipe)
    }

    /** Creates the lock directory, which the user may have deleted, then writes the lock unless released. */
    private fun writeLock(): Boolean {
        try {
            env.fs.makeDirectories(lockFile.lockDir, LockPaths.LOCK_DIR_MODE)
        } catch (e: Exception) {
            e.rethrowIfCancellation()
            log.warn("could not write ${lockFile.lockPath}", e)
            return false
        }
        if (released) return false
        return keepUnlessReleased(lockFile.write(record()))
    }

    /** A release that came while the write was on disk ran before its rename landed, so that lock goes again. */
    private fun keepUnlessReleased(written: Boolean): Boolean {
        if (!released) return written
        lockFile.removeSync()
        return false
    }

    /** Every state writes one: hub false, with no pipe, guards the paths of a hub not serving. */
    private fun record(): LockRecord {
        val current = serving
        val scoped = scope
        return LockRecord(
            pipe = current?.pipe ?: "",
            workspaceFolders = scoped.folders,
            documents = scoped.documents,
            ide = host.ide,
            version = env.version,
            protocolVersion = HUB_PROTOCOL_VERSION.toLong(),
            token = current?.token ?: "",
            hub = current != null,
        )
    }
}
