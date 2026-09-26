package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.io.IOException
import java.util.concurrent.CancellationException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

class HubThreadsTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    @get:Rule
    val testThreads = TestThreads()

    private val log = RecordingLog()

    @Test
    fun `runs posted blocks in order on one daemon registry thread with the system class loader`() {
        val threads = testThreads.create(log)
        val seen = CopyOnWriteArrayList<Int>()
        val names = CopyOnWriteArrayList<String>()
        val done = CountDownLatch(1)

        repeat(100) { index ->
            threads.post {
                seen += index
                names += Thread.currentThread().name
                if (index == 99) {
                    assertTrue(Thread.currentThread().isDaemon)
                    assertSame(ClassLoader.getSystemClassLoader(), Thread.currentThread().contextClassLoader)
                    done.countDown()
                }
            }
        }

        assertTrue(done.await(5, TimeUnit.SECONDS))
        assertEquals((0 until 100).toList(), seen)
        assertEquals(setOf("${threads.namePrefix}-registry"), names.toSet())
    }

    @Test
    fun `logs a posted block that throws and runs the next one, but never logs a cancellation`() {
        val threads = testThreads.create(log)
        val error = IllegalStateException("boom")
        val ran = CountDownLatch(1)

        threads.post { throw error }
        threads.post { throw CancellationException("stopped") }
        threads.post { ran.countDown() }

        assertTrue(ran.await(5, TimeUnit.SECONDS))
        assertEquals(listOf("request failed" to error), log.lines)
    }

    @Test
    fun `schedules a block on the registry thread after its delay, and cancels one on request`() {
        val threads = testThreads.create(log)
        val start = System.nanoTime()
        val ranAfterMs = CopyOnWriteArrayList<Long>()
        val cancelled = AtomicBoolean(false)

        val kept = threads.schedule(50) { ranAfterMs += TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start) }
        threads.schedule(30) { cancelled.set(true) }!!.cancel(false)

        awaitUntil { ranAfterMs.isNotEmpty() }
        assertTrue(kept!!.isDone)
        assertTrue("ran after ${ranAfterMs[0]} ms", ranAfterMs[0] >= 50)
        Thread.sleep(60)
        assertFalse(cancelled.get())
    }

    @Test
    fun `answers a blocking call with its value, and null on timeout or failure`() {
        val threads = testThreads.create(log)
        val error = IOException("gone")
        val release = CountDownLatch(1)

        assertEquals("${threads.namePrefix}-registry", threads.callBlocking(1_000) { Thread.currentThread().name })
        threads.post { release.await(5, TimeUnit.SECONDS) }
        assertNull(threads.callBlocking(50) { "late" })
        release.countDown()
        assertNull(threads.callBlocking(1_000) { throw error })
        assertNull(threads.callBlocking(1_000) { throw CancellationException("stopped") })

        assertEquals(listOf("request failed" to error), log.lines)
    }

    @Test
    fun `runs a blocking call made on the registry thread itself inline`() {
        val threads = testThreads.create(log)
        val error = IllegalStateException("inline")

        val answers = threads.callBlocking(1_000) {
            listOf(threads.callBlocking(1) { "inner" }, threads.callBlocking(1) { throw error })
        }

        assertEquals(listOf("inner", null), answers)
        assertEquals(listOf("request failed" to error), log.lines)
    }

    @Test
    fun `stops waiting for a blocking call when its thread is interrupted`() {
        val threads = testThreads.create(log)
        val release = CountDownLatch(1)
        threads.post { release.await(5, TimeUnit.SECONDS) }

        Thread.currentThread().interrupt()
        val answer = threads.callBlocking(5_000) { "never" }

        assertNull(answer)
        assertTrue(Thread.interrupted())
        release.countDown()
    }

    @Test
    fun `frees a blocking call still queued at shutdown, and drops everything after it`() {
        val threads = testThreads.create(log)
        val release = CountDownLatch(1)
        val ran = AtomicBoolean(false)
        val answer = AtomicReference<Any?>("unset")
        threads.post { awaitIgnoringInterrupts(release) }
        val queued = Thread { answer.set(threads.callBlocking(10_000) { "queued" }) }.apply { start() }
        awaitUntil { queued.state == Thread.State.TIMED_WAITING }

        assertFalse(threads.shutdown(100))
        queued.join(5_000)
        assertFalse(queued.isAlive)
        assertNull(answer.get())
        release.countDown()
        assertTrue(threads.shutdown(2_000))
        assertTrue(threads.registryExecutor.isTerminated)
        assertTrue(threads.ioExecutor.isTerminated)

        threads.post { ran.set(true) }
        assertNull(threads.schedule(1) { ran.set(true) })
        assertNull(threads.callBlocking(1_000) { "after" })
        assertFalse(ran.get())
    }

    @Test
    fun `logs a failing launched job through the scope's handler, and runs a launch on registry by default`() {
        val threads = testThreads.create(log)
        val error = IllegalArgumentException("job")
        val names = CopyOnWriteArrayList<String>()

        runBlocking {
            threads.scope.launch { names += threadName() }.join()
            threads.scope.launch(threads.io) { names += threadName() }.join()
            threads.scope.launch { throw error }.join()
            threads.scope.launch { throw CancellationException("stopped") }.join()
            val survivor = threads.scope.launch { delay(1) }
            survivor.join()
            assertFalse(survivor.isCancelled)
        }

        assertEquals("${threads.namePrefix}-registry", names[0])
        assertTrue(names[1], names[1].startsWith("${threads.namePrefix}-io-"))
        assertEquals(listOf("request failed" to error), log.lines)
        assertEquals(threads.namePrefix, threads.scope.coroutineContext[CoroutineName]?.name)
    }

    @Test
    fun `runs blocking work on daemon io threads and delays on the registry dispatcher`() {
        val threads = testThreads.create(log)

        val (ioThread, afterDelay) = runBlocking {
            val ioThread = withContext(threads.io) { Thread.currentThread() }
            val afterDelay = withContext(threads.registry) {
                delay(20)
                threadName()
            }
            ioThread to afterDelay
        }

        assertTrue(ioThread.name, ioThread.name.matches(Regex("${Regex.escape(threads.namePrefix)}-io-\\d+")))
        assertTrue(ioThread.isDaemon)
        assertSame(ClassLoader.getSystemClassLoader(), ioThread.contextClassLoader)
        assertEquals("${threads.namePrefix}-registry", afterDelay)
    }

    @Test
    fun `cancels the scope's jobs on shutdown and ends every thread within its bound`() {
        val threads = testThreads.create(log)
        val suspended = CompletableDeferred<Unit>()
        val job = threads.scope.launch(threads.io) { suspended.await() }
        threads.ioExecutor.execute { awaitIgnoringInterrupts(CountDownLatch(1), 200) }
        awaitUntil { testThreads.liveThreads().isNotEmpty() }

        assertTrue(threads.shutdown(2_000))

        assertTrue(job.isCancelled)
        assertEquals(emptyList<Thread>(), testThreads.liveThreads())
        assertEquals(emptyList<Pair<String, Any?>>(), log.lines)
    }

    @Test
    fun `answers false when a registry or io thread outlives the shutdown bound`() {
        for (onIo in listOf(false, true)) {
            val threads = testThreads.create(log)
            val stubborn = CountDownLatch(1)
            val started = CountDownLatch(1)
            val block = {
                started.countDown()
                awaitIgnoringInterrupts(stubborn)
            }
            if (onIo) threads.ioExecutor.execute(block) else threads.post(block)
            assertTrue(started.await(5, TimeUnit.SECONDS))

            assertFalse("on io: $onIo", threads.shutdown(100))
            stubborn.countDown()
            assertTrue("on io: $onIo", threads.shutdown(2_000))
        }
    }

    @Test
    fun `answers false when its own thread is interrupted while it waits`() {
        val threads = testThreads.create(log)
        val stubborn = CountDownLatch(1)
        val started = CountDownLatch(1)
        threads.post {
            started.countDown()
            awaitIgnoringInterrupts(stubborn)
        }
        assertTrue(started.await(5, TimeUnit.SECONDS))

        Thread.currentThread().interrupt()
        assertFalse(threads.shutdown(5_000))
        assertTrue(Thread.interrupted())
        stubborn.countDown()
    }

    @Test
    fun `answers from shutdown while other threads start io work and post for the first time, and again after`() {
        repeat(RACE_ROUNDS) { round ->
            val threads = testThreads.create(log)
            val go = CyclicBarrier(3)
            val io = Thread {
                go.await()
                repeat(100) {
                    try {
                        threads.ioExecutor.execute { sleepIgnoringInterrupt() }
                    } catch (e: RejectedExecutionException) {
                        return@Thread
                    }
                }
            }
            val poster = Thread {
                go.await()
                repeat(100) { threads.post {} }
            }
            listOf(io, poster).forEach { it.start() }
            go.await()
            // Lands the shutdown at a different point of the submitters' run each round.
            repeat((round % 50) * 100) { Thread.onSpinWait() }

            threads.shutdown(500)
            io.join(5_000)
            poster.join(5_000)

            assertTrue("round $round", threads.shutdown(2_000))
        }
        assertEquals(emptyList<Pair<String, Any?>>(), log.lines)
    }

    @Test
    fun `rethrows a cancellation and lets anything else pass`() {
        val cancellation = CancellationException("stopped")

        val thrown = assertThrows(CancellationException::class.java) { cancellation.rethrowIfCancellation() }

        assertSame(cancellation, thrown)
        IOException("kept").rethrowIfCancellation()
    }

    /** Waits as a blocking file call does, deaf to the interrupt shutdownNow sends, at most capMs. */
    private fun awaitIgnoringInterrupts(latch: CountDownLatch, capMs: Long = 10_000) {
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(capMs)
        while (latch.count > 0 && System.nanoTime() < deadline) {
            try {
                latch.await(deadline - System.nanoTime(), TimeUnit.NANOSECONDS)
            } catch (e: InterruptedException) {
                // Deaf to it on purpose.
            }
        }
    }

    /** A millisecond of io work, cut short by the interrupt shutdownNow sends. */
    private fun sleepIgnoringInterrupt() {
        try {
            Thread.sleep(1)
        } catch (e: InterruptedException) {
            // Shut down: the task simply ends.
        }
    }

    /** The thread's own name, without the " @coroutine#n" the coroutines debug agent appends inside a coroutine. */
    private fun threadName(): String = Thread.currentThread().name.substringBefore(" @")

    private companion object {
        /** Enough rounds to land a shutdown between a pool creating a thread and starting it. */
        const val RACE_ROUNDS = 200
    }
}
