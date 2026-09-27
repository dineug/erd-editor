package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentRegistry
import com.github.dineug.erdeditorintellijplugin.hub.document.HubRequestHandler
import com.github.dineug.erdeditorintellijplugin.hub.document.IdeFacade
import com.github.dineug.erdeditorintellijplugin.hub.server.DocumentHub
import com.github.dineug.erdeditorintellijplugin.hub.server.HubConnection
import com.github.dineug.erdeditorintellijplugin.hub.server.HubHost
import com.github.dineug.erdeditorintellijplugin.hub.server.RuntimeShutdownHooks
import com.github.dineug.erdeditorintellijplugin.hub.server.ShutdownHooks
import com.github.dineug.erdeditorintellijplugin.hub.transport.HubListenerFactory
import com.github.dineug.erdeditorintellijplugin.hub.transport.platformListenerFactory
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.CancellationException
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The agent hub as the IDE layer holds it, as Obsidian's hub runtime and lifecycle: the document
 * registry from plugin load on, and the DocumentHub serving it when env names a machine. It stops in
 * order: the peers hear documentClosed and their frames drain, then the lock and the pipe go, then the threads.
 */
class HubRuntime(
    private val env: HubEnvironment?,
    private val host: HubHost,
    private val ide: IdeFacade,
    private val listeners: (HubThreads, HubLog) -> HubListenerFactory = { threads, log ->
        platformListenerFactory(env!!.platform, threads.ioExecutor, log)
    },
    private val hooks: ShutdownHooks = RuntimeShutdownHooks,
    private val log: HubLog,
    private val platform: HubPlatform,
    private val clock: HubClock = HubClock.monotonic,
    val timings: HubTimings = HubTimings(),
    val threads: HubThreads = HubThreads(log),
) {
    private val authz: Authz? = env?.let(::Authz)

    /** Every open ERD file and its editors, whether or not a hub serves them. */
    val registry: DocumentRegistry =
        DocumentRegistry(platform, authz, threads, clock, log, timings, env?.fs ?: NioFileSystem)

    /**
     * Null without a machine (a headless, sandboxed or JCEF-less IDE): no lock, no sweep. Every
     * lock write hands its scope to the registry, which closes the paths a peer may no longer reach.
     */
    val hub: DocumentHub? = env?.let { machine ->
        // Requests reach the handler only through this hub, so it is there by the first one.
        val handler = HubRequestHandler(registry, ide, machine, authz!!, { hub!!.scope }, threads, log, timings)
        DocumentHub(machine, host, registry, handler, listeners(threads, log), threads, log, timings, registry::revoke)
    }

    /** Deletes the lock and both socket paths when the JVM goes down without dispose, and nothing else. */
    private val releaseHook: Thread? = hub?.let { served ->
        Thread({ served.releaseSync() }, "${threads.namePrefix}-release").apply {
            contextClassLoader = ClassLoader.getSystemClassLoader()
        }
    }

    private val lifecycle = Any()
    private var started = false
    private var disposed = false
    private var addedHook: Thread? = null
    private val peersShutDown = AtomicBoolean()

    /** Adds the release hook, then starts the hub, which hands the registry its publisher. Once. */
    fun start() {
        synchronized(lifecycle) {
            if (started || disposed) return
            started = true
            releaseHook?.let {
                try {
                    hooks.add(it)
                } catch (e: IllegalStateException) {
                    // The JVM is already going down: a hub started now would only leave a lock behind.
                    return
                }
                addedHook = it
            }
        }
        hub?.start()
    }

    /**
     * For the IDE closing, before its projects close, and for dispose. Lets go of the host's events,
     * so no project closing queues a folder change, tells every peer documentClosed for every path
     * it joined or read, waits drainCapMs at most for those frames, then retires the hub. Idempotent.
     */
    fun shutdownPeers() {
        if (!peersShutDown.compareAndSet(false, true)) return
        hub?.detach()
        val told = registry.callBlocking(timings.registryCallBoundMs) { shutdown() }.orEmpty()
        drain(told)
        // Until dispose deletes the lock, a hub false lock keeps agents off the editors still open.
        hub?.retire()
    }

    /**
     * Removes the release hook, shuts the peers down, closes the hub within closeBoundMs and joins
     * the threads within threadJoinBoundMs. Runs on the EDT inside a write action, so no step waits
     * on a read lock; it never throws, and a bound it hits is logged. Idempotent.
     */
    fun dispose() {
        val hook = synchronized(lifecycle) {
            if (disposed) return
            disposed = true
            addedHook.also { addedHook = null }
        }
        hook?.let(::removeHook)
        shutdownPeers()
        hub?.close(timings.closeBoundMs)
        if (!threads.shutdown(timings.threadJoinBoundMs)) {
            log.warn(CLOSE_FAILED, TimeoutException("the hub's threads did not end within ${timings.threadJoinBoundMs} ms"))
        }
    }

    private fun removeHook(hook: Thread) {
        try {
            hooks.remove(hook)
        } catch (e: IllegalStateException) {
            // The JVM is going down and runs the hook anyway, which only deletes files.
        }
    }

    /** Waits drainCapMs at most for every connection to write what it holds; a drain never fails. */
    private fun drain(connections: List<HubConnection>) {
        val drains = connections.map(HubConnection::drain).toTypedArray()
        try {
            CompletableFuture.allOf(*drains).get(timings.drainCapMs, TimeUnit.MILLISECONDS)
        } catch (e: TimeoutException) {
            // What a peer has not read by the cap goes when close destroys its connection.
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (e: ExecutionException) {
            // A connection that could not drain is destroyed by close all the same.
        } catch (e: CancellationException) {
            // Likewise for a drain cancelled under it.
        }
    }

    private companion object {
        const val CLOSE_FAILED = "could not close the document hub"
    }
}
