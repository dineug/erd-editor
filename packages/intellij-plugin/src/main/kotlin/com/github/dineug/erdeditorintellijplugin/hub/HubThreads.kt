package com.github.dineug.erdeditorintellijplugin.hub

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel
import java.time.Duration
import java.util.concurrent.Callable
import java.util.concurrent.CancellationException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutionException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.ScheduledThreadPoolExecutor
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.ThreadFactory
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicInteger

/** Rethrows a coroutine's cancellation, which the hub neither logs nor folds into a result. */
internal fun Throwable.rethrowIfCancellation() {
    if (this is CancellationException) throw this
}

/**
 * Every thread the hub runs on: one registry thread that owns all registry state and runs every
 * handler in submission order, and a cached io pool for anything that blocks. Threads are daemons
 * with the system class loader as context loader, so nothing they create pins the plugin's.
 */
class HubThreads(private val log: HubLog, val namePrefix: String = "erd-editor-hub") {
    /** Every thread created and not yet ended, for shutdown to join. */
    private val started = ConcurrentHashMap.newKeySet<Thread>()
    private val ioThreads = AtomicInteger()

    @Volatile
    private var registryThread: Thread? = null

    /** One daemon thread "$namePrefix-registry"; FIFO for tasks due at once, and the owner of every timer. */
    val registryExecutor: ScheduledExecutorService =
        ScheduledThreadPoolExecutor(1, threadFactory({ "$namePrefix-registry" }) { registryThread = it })
            .apply { removeOnCancelPolicy = true }

    /** registryExecutor as a dispatcher: FIFO, and its Delay schedules on the same thread. */
    val registry: CoroutineDispatcher = registryExecutor.asCoroutineDispatcher()

    /** Cached daemon threads "$namePrefix-io-<n>", for file system, socket and realpath calls. */
    val ioExecutor: ExecutorService = ThreadPoolExecutor(
        0, Int.MAX_VALUE, IO_KEEP_ALIVE_SECONDS, TimeUnit.SECONDS, SynchronousQueue(),
        threadFactory({ "$namePrefix-io-${ioThreads.incrementAndGet()}" }),
    )

    val io: CoroutineDispatcher = ioExecutor.asCoroutineDispatcher()

    /**
     * SupervisorJob() + CoroutineName(namePrefix) + CoroutineExceptionHandler, so one failing job
     * logs "request failed" and harms no other; a launch that names no dispatcher runs on registry.
     */
    val scope: CoroutineScope = CoroutineScope(
        SupervisorJob() + CoroutineName(namePrefix) + registry +
            CoroutineExceptionHandler { _, error -> log.warn("request failed", error) },
    )

    /** Runs block on the registry thread after every task queued before it; dropped after shutdown. */
    fun post(block: () -> Unit) {
        try {
            registryExecutor.execute { runLogged(block) }
        } catch (e: RejectedExecutionException) {
            // Shut down: nothing runs on the registry any more.
        }
    }

    /** Runs block on the registry thread after delayMs; null after shutdown. */
    fun schedule(delayMs: Long, block: () -> Unit): ScheduledFuture<*>? = try {
        registryExecutor.schedule(Runnable { runLogged(block) }, delayMs, TimeUnit.MILLISECONDS)
    } catch (e: RejectedExecutionException) {
        null
    }

    /**
     * Runs block on the registry thread and waits at most timeoutMs for its value: null on timeout,
     * after shutdown and when block throws (logged). On the registry thread itself it runs inline.
     */
    fun <T> callBlocking(timeoutMs: Long, block: () -> T): T? {
        if (Thread.currentThread() === registryThread) return callLogged(block)
        val future = try {
            registryExecutor.submit(Callable { block() })
        } catch (e: RejectedExecutionException) {
            return null
        }
        return try {
            future.get(timeoutMs, TimeUnit.MILLISECONDS)
        } catch (e: TimeoutException) {
            null
        } catch (e: CancellationException) {
            null
        } catch (e: ExecutionException) {
            // A FutureTask's ExecutionException always carries what the block threw.
            logFailure(e.cause)
            null
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            null
        }
    }

    /**
     * Cancels scope, shuts both executors down now and waits for every thread they started to end:
     * false when one outlived boundMs. A task still queued is cancelled, so callBlocking stops waiting.
     * The resumptions scope.cancel() queues go with it, so a coroutine's finally may never run, and
     * one resumed later runs off these threads (kotlinx's rejection fallback): cleanup belongs before.
     */
    fun shutdown(boundMs: Long): Boolean {
        scope.cancel()
        // A ScheduledThreadPoolExecutor queues nothing but its own ScheduledFutures.
        registryExecutor.shutdownNow().forEach { (it as Future<*>).cancel(false) }
        ioExecutor.shutdownNow()
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(boundMs)
        fun leftNanos() = maxOf(0L, deadline - System.nanoTime())
        return try {
            // Terminated, neither executor starts a thread again: one still NEW is a worker it gave up on.
            val terminated = registryExecutor.awaitTermination(leftNanos(), TimeUnit.NANOSECONDS) &&
                ioExecutor.awaitTermination(leftNanos(), TimeUnit.NANOSECONDS)
            if (terminated) started.removeIf { it.state == Thread.State.NEW }
            terminated && started.all { it.join(Duration.ofNanos(leftNanos())) }
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            false
        }
    }

    private fun threadFactory(name: () -> String, created: (Thread) -> Unit = {}): ThreadFactory =
        ThreadFactory { runnable ->
            // A thread leaves the set as it ends, so the set holds just the threads shutdown may wait for.
            val thread = Thread({
                try {
                    runnable.run()
                } finally {
                    started -= Thread.currentThread()
                }
            }, name())
            thread.isDaemon = true
            thread.contextClassLoader = ClassLoader.getSystemClassLoader()
            started += thread
            created(thread)
            thread
        }

    private fun runLogged(block: () -> Unit) {
        try {
            block()
        } catch (e: Throwable) {
            logFailure(e)
        }
    }

    private fun <T> callLogged(block: () -> T): T? = try {
        block()
    } catch (e: Throwable) {
        logFailure(e)
        null
    }

    /** "request failed" with the error; a cancellation is control flow, never logged. */
    private fun logFailure(error: Throwable?) {
        if (error !is CancellationException) log.warn("request failed", error)
    }

    private companion object {
        const val IO_KEEP_ALIVE_SECONDS = 60L
    }
}
