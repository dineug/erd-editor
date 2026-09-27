package com.github.dineug.erdeditorintellijplugin.agents

import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeClock
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicInteger

/**
 * The host's IDE-free parts: the folder list the lock gets from every open project, and the burst
 * coalescing that turns a storm of root changes into one folder read. The rest reads the IDE live.
 */
class IntelliJHubHostTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    @get:Rule
    val testThreads = TestThreads()

    @Test
    fun `lists each project's roots in project order, each folder once`() {
        val projects = listOf(
            "a" to listOf("/work/a", "/work/a/module", "/work/a"),
            "b" to listOf("/work/b"),
            "c" to listOf("/work/a/module", "/work/c"),
        )

        assertEquals(
            listOf("/work/a", "/work/a/module", "/work/b", "/work/c"),
            unionFolders(projects) { it.second },
        )
    }

    @Test
    fun `keeps spellings apart, as the hub realpaths each`() {
        val projects = listOf(listOf("/Work/A"), listOf("/work/a"))

        assertEquals(listOf("/Work/A", "/work/a"), unionFolders(projects) { it })
    }

    @Test
    fun `lists nothing without a project`() {
        assertEquals(emptyList<String>(), unionFolders(emptyList<List<String>>()) { it })
        assertEquals(emptyList<String>(), unionFolders(listOf(emptyList<String>())) { it })
    }

    @Test
    fun `a burst of folder changes fires once, after it pauses`() {
        val (coalescer, fired) = manual()

        repeat(20) {
            coalescer.request()
            clock.advance(5.0)
        }

        assertEquals(0, fired.get())
        val due = scheduler.live().single()
        assertEquals(95.0 + DELAY_MS, due.dueMs, 0.0)
        assertEquals(19, scheduler.tasks.count { it.future.isCancelled })
        due.run()
        assertEquals(1, fired.get())
    }

    @Test
    fun `a burst that never pauses fires at its cap, then starts another`() {
        val (coalescer, fired) = manual()

        repeat(30) {
            coalescer.request()
            clock.advance(10.0)
        }

        assertEquals(CAP_MS.toDouble(), scheduler.live().single().dueMs, 0.0)
        scheduler.live().single().run()
        assertEquals(1, fired.get())
        coalescer.request()
        assertEquals(clock.now + DELAY_MS, scheduler.live().single().dueMs, 0.0)
    }

    @Test
    fun `a fire a later request replaced after it started leaves the firing to that request`() {
        val (coalescer, fired) = manual()
        coalescer.request()
        val replaced = scheduler.live().single()

        coalescer.request()
        replaced.block()

        assertEquals(0, fired.get())
        scheduler.live().single().run()
        assertEquals(1, fired.get())
    }

    @Test
    fun `a request made while the burst fires fires again`() {
        lateinit var coalescer: Coalescer
        val fired = AtomicInteger()
        coalescer = Coalescer(DELAY_MS, CAP_MS, scheduler::schedule, clock) {
            if (fired.incrementAndGet() == 1) coalescer.request()
        }
        coalescer.request()

        scheduler.live().single().run()
        scheduler.live().single().run()

        assertEquals(2, fired.get())
    }

    @Test
    fun `a request the stopped threads refused leaves the next one to schedule`() {
        val (coalescer, fired) = manual()
        scheduler.refuse = 1

        coalescer.request()
        assertTrue(scheduler.tasks.isEmpty())
        // Past the cap of the refused burst, which a request that still counted it would never fire.
        clock.advance(CAP_MS * 2.0)
        coalescer.request()

        scheduler.live().single().run()
        assertEquals(1, fired.get())
    }

    @Test
    fun `fires once a burst on the hub's threads pauses, and again for a change after`() {
        val fired = AtomicInteger()
        val threads = testThreads.create(RecordingLog())
        val coalescer = Coalescer(DELAY_MS, CAP_MS, threads::schedule) { fired.incrementAndGet() }

        repeat(20) { coalescer.request() }
        awaitUntil(message = "the burst fired") { fired.get() == 1 }
        Thread.sleep(DELAY_MS * 3)
        assertEquals(1, fired.get())
        coalescer.request()
        coalescer.request()

        awaitUntil(message = "the second burst fired") { fired.get() == 2 }
        Thread.sleep(DELAY_MS * 3)
        assertEquals(2, fired.get())
    }

    @Test
    fun `fires nothing once the hub's threads stopped`() {
        val fired = AtomicInteger()
        val threads = testThreads.create(RecordingLog())
        val coalescer = Coalescer(DELAY_MS, CAP_MS, threads::schedule) { fired.incrementAndGet() }
        threads.shutdown(1_000)

        coalescer.request()
        coalescer.request()
        Thread.sleep(DELAY_MS * 3)

        assertEquals(0, fired.get())
    }

    private val clock = FakeClock()
    private val scheduler = ManualScheduler(clock)

    private fun manual(): Pair<Coalescer, AtomicInteger> {
        val fired = AtomicInteger()
        return Coalescer(DELAY_MS, CAP_MS, scheduler::schedule, clock) { fired.incrementAndGet() } to fired
    }

    /** HubThreads.schedule by hand: a test runs each task itself, and refuse stands for stopped threads. */
    private class ManualScheduler(private val clock: FakeClock) {
        class Task(val dueMs: Double, val block: () -> Unit, val future: CompletableFuture<Unit>) {
            fun run() {
                block()
                future.complete(Unit)
            }
        }

        val tasks = ArrayList<Task>()
        var refuse = 0

        fun schedule(delayMs: Long, block: () -> Unit): Future<*>? {
            if (refuse > 0) {
                refuse--
                return null
            }
            return CompletableFuture<Unit>().also { tasks += Task(clock.now + delayMs, block, it) }
        }

        fun live(): List<Task> = tasks.filter { !it.future.isDone }
    }

    private companion object {
        const val DELAY_MS = 50L
        const val CAP_MS = 200L
    }
}
