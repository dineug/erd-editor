package com.github.dineug.erdeditorintellijplugin.hub.server

import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import java.util.concurrent.CancellationException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.atomic.AtomicInteger

/**
 * The one FIFO every change of the hub's state goes through, as DocumentHub.ts chains its promises:
 * tasks run one at a time as coroutines on threads.io, and a task still queued once [closed] is
 * skipped. A failing task is logged raw and the queue goes on, so the lock follows the host's events.
 */
class StateQueue(private val threads: HubThreads, private val log: HubLog) {
    /** Set by the hub's close and releaseSync; a task that has not started by then never runs. */
    @Volatile
    var closed: Boolean = false

    /** Listen tasks queued or running: a publish behind one resolves at once rather than wait for a bind. */
    val listensAhead: AtomicInteger = AtomicInteger()

    private val lock = Any()
    private val tasks = Channel<Task>(Channel.UNLIMITED)

    /** The task running now; guarded by lock, so close never misses one that just started. */
    private var current: Task? = null

    init {
        // Once the hub's threads stop, what is still queued is settled rather than awaited forever.
        threads.scope.launch(threads.io) { consume() }.invokeOnCompletion {
            tasks.close()
            while (true) {
                val task = tasks.tryReceive().getOrNull() ?: break
                task.settle()
            }
        }
    }

    /** Runs task after every task queued before; the future completes once it ran or was skipped, never exceptionally. */
    fun enqueue(task: suspend () -> Unit): CompletableFuture<Unit> = submit(Task(task, listens = false))

    /** enqueue for a task that may listen, counted in listensAhead from this call until the task settled. */
    fun enqueueListen(task: suspend () -> Unit): CompletableFuture<Unit> {
        listensAhead.incrementAndGet()
        return submit(Task(task, listens = true))
    }

    /** The task running now, if any, for the bounded close. */
    fun running(): CompletableFuture<Unit>? = synchronized(lock) { current?.done }

    /** Cancels the running task's Job, so a task suspended in a host call unwinds at once. */
    fun cancelRunning() {
        synchronized(lock) { current?.job }?.cancel()
    }

    private fun submit(task: Task): CompletableFuture<Unit> {
        if (tasks.trySend(task).isFailure) task.settle()
        return task.done
    }

    private suspend fun consume() {
        for (task in tasks) {
            val job = synchronized(lock) {
                if (closed) return@synchronized null
                // Lazy, so current names the task before it can run and cancelRunning always finds it.
                threads.scope.launch(threads.io, CoroutineStart.LAZY) { run(task) }.also {
                    task.job = it
                    current = task
                }
            }
            if (job == null) {
                task.settle()
                continue
            }
            job.invokeOnCompletion { task.settle() }
            job.start()
            job.join()
            synchronized(lock) { current = null }
        }
    }

    private suspend fun run(task: Task) {
        try {
            task.block()
        } catch (e: CancellationException) {
            // cancelRunning stops a task where it stands, which is no failure.
        } catch (e: Throwable) {
            log.warn("", e)
        }
    }

    /** Settled exactly once: refused by a closed channel, skipped, run to its end, or drained at shutdown. */
    private inner class Task(val block: suspend () -> Unit, private val listens: Boolean) {
        val done = CompletableFuture<Unit>()
        var job: Job? = null

        /** Counts the task out of listensAhead and completes it, whether it ran or was skipped. */
        fun settle() {
            if (listens) listensAhead.decrementAndGet()
            done.complete(Unit)
        }
    }
}
