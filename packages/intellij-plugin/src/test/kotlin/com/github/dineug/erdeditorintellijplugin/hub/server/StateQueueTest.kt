package com.github.dineug.erdeditorintellijplugin.hub.server

import com.github.dineug.erdeditorintellijplugin.hub.testing.MemoryHost
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.io.IOException
import java.util.concurrent.CancellationException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * The one queue every change of the hub's state goes through, as DocumentHub.ts chains its tasks:
 * one at a time in order, a failure logged raw and passed over, a task queued before close skipped,
 * listensAhead counted from the enqueue, and a running task cancelled where it is suspended.
 */
class StateQueueTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    @get:Rule
    val testThreads = TestThreads()

    private val log = RecordingLog()

    private fun queue() = StateQueue(testThreads.create(log), log)

    private fun CompletableFuture<Unit>.await() = get(5, TimeUnit.SECONDS)

    @Test
    fun `runs tasks one at a time in the order they were queued, on io`() {
        val queue = queue()
        val order = CopyOnWriteArrayList<Int>()
        val running = AtomicInteger()
        val overlaps = AtomicInteger()
        val threadNames = CopyOnWriteArrayList<String>()

        val futures = (0 until 20).map { index ->
            queue.enqueue {
                if (running.incrementAndGet() > 1) overlaps.incrementAndGet()
                threadNames += Thread.currentThread().name
                delay(1)
                order += index
                running.decrementAndGet()
            }
        }
        futures.forEach { it.await() }

        assertEquals((0 until 20).toList(), order)
        assertEquals(0, overlaps.get())
        assertTrue(threadNames.toString(), threadNames.all { "-io-" in it })
    }

    @Test
    fun `logs a failing task raw and goes on with the next`() {
        val queue = queue()
        val failure = IOException("settings.json is not JSON")
        val ran = CompletableFuture<Unit>()

        val failing = queue.enqueue { throw failure }
        queue.enqueue { ran.complete(Unit) }.await()

        failing.await()
        assertTrue(ran.isDone)
        assertEquals(listOf("" to failure), log.lines)
    }

    @Test
    fun `passes over a task that stops by cancellation without a log line`() {
        val queue = queue()

        queue.enqueue { throw CancellationException("stopped") }.await()
        queue.enqueue {}.await()

        assertEquals(emptyList<Pair<String, Any?>>(), log.lines)
    }

    @Test
    fun `skips every task not started when it closes, and settles it`() {
        val queue = queue()
        val gate = CompletableDeferred<Unit>()
        val entered = CompletableFuture<Unit>()
        val ran = AtomicInteger()
        val running = queue.enqueue {
            entered.complete(Unit)
            gate.await()
            ran.incrementAndGet()
        }
        entered.await()
        val queued = queue.enqueue { ran.incrementAndGet() }

        queue.closed = true
        gate.complete(Unit)
        running.await()
        queued.await()
        queue.enqueue { ran.incrementAndGet() }.await()

        assertEquals("only the task running at close ran", 1, ran.get())
    }

    @Test
    fun `counts a listen task in listensAhead from the enqueue until it settled, run or skipped`() {
        val queue = queue()
        val gate = CompletableDeferred<Unit>()
        val entered = CompletableFuture<Unit>()
        queue.enqueue {
            entered.complete(Unit)
            gate.await()
        }
        entered.await()

        val first = queue.enqueueListen {}
        val second = queue.enqueueListen {}
        assertEquals("queued, not yet running", 2, queue.listensAhead.get())

        gate.complete(Unit)
        first.await()
        second.await()
        assertEquals(0, queue.listensAhead.get())

        queue.closed = true
        queue.enqueueListen {}.await()
        assertEquals("a skipped listen is counted out too", 0, queue.listensAhead.get())
    }

    @Test
    fun `cancels the running task where it is suspended in a host call, and the queue goes on`() {
        val queue = queue()
        val host = MemoryHost(roots = listOf("/ws")).apply { foldersGate = CompletableDeferred() }
        val answered = AtomicInteger()
        assertNull("nothing runs yet", queue.running())

        val suspended = queue.enqueue {
            host.folders()
            answered.incrementAndGet()
        }
        awaitUntil(message = "the task suspended in folders") { host.foldersCalls.get() == 1 }
        val next = queue.enqueue { answered.addAndGet(10) }

        assertSame(suspended, queue.running())
        queue.cancelRunning()
        suspended.await()
        next.await()

        assertEquals("the suspended task never went past folders", 10, answered.get())
        assertTrue(log.lines.isEmpty())
        awaitUntil(message = "nothing running") { queue.running() == null }
        queue.cancelRunning()
    }

    @Test
    fun `settles every task at once once its threads stopped`() {
        val threads = testThreads.create(log)
        val queue = StateQueue(threads, log)
        val gate = CompletableDeferred<Unit>()
        val entered = CompletableFuture<Unit>()
        val running = queue.enqueue {
            entered.complete(Unit)
            gate.await()
        }
        entered.await()
        val queued = queue.enqueueListen {}

        assertTrue(threads.shutdown(2_000))

        running.await()
        queued.await()
        assertEquals(0, queue.listensAhead.get())
        val late = queue.enqueue { throw AssertionError("a task after shutdown never runs") }
        late.await()
        assertFalse(late.isCompletedExceptionally)
    }
}
