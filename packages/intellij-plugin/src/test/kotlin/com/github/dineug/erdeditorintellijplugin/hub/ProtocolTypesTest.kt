package com.github.dineug.erdeditorintellijplugin.hub

import com.fasterxml.jackson.databind.node.ArrayNode
import com.github.dineug.erdeditorintellijplugin.hub.document.OpenRefused
import com.github.dineug.erdeditorintellijplugin.hub.server.ApplyParams
import com.github.dineug.erdeditorintellijplugin.hub.server.HandlerResult
import com.github.dineug.erdeditorintellijplugin.hub.server.HubNotification
import com.github.dineug.erdeditorintellijplugin.hub.server.HubResults
import com.github.dineug.erdeditorintellijplugin.hub.server.OpenParams
import com.github.dineug.erdeditorintellijplugin.hub.server.PathParams
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CyclicBarrier

/**
 * The types the later stages build on, each constructed once here: the connection server hands
 * requests over in them, and a notification's frame is shared by every peer it goes to.
 */
class ProtocolTypesTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    private val actions = HubJson.parse("[{\"type\":\"table.add\",\"payload\":{\"comment\":null}},null]") as ArrayNode

    @Test
    fun `carries a handler's params`() {
        assertEquals(OpenParams("/real/a.erd", true, "{}"), OpenParams("/real/a.erd", create = true, "{}"))
        assertNull(OpenParams("/real/a.erd", false, null).initialValue)
        assertEquals("/real/a.erd", PathParams("/real/a.erd").path)
        val apply = ApplyParams("/real/a.erd", actions)
        assertSame(actions, apply.actions)
        assertEquals("/real/a.erd", apply.path)
    }

    @Test
    fun `runs a result's follow-up only when it has one`() {
        var ran = false
        val result = HandlerResult(HubResults.leave()) { ran = true }
        result.afterResponse!!.invoke()
        assertTrue(ran)
        assertNull(HandlerResult(HubResults.save(true)).afterResponse)
        assertEquals("{\"saved\":true}", HubJson.stringify(HandlerResult(HubResults.save(true)).result))
    }

    @Test
    fun `encodes a notification's frame once for every peer`() {
        val notification = HubNotification.Actions("/real/a.erd", actions)
        assertEquals("/real/a.erd", notification.path)
        assertSame(actions, notification.actions)

        val frames = ConcurrentLinkedQueue<ByteArray>()
        val barrier = CyclicBarrier(4)
        val peers = List(4) {
            Thread {
                barrier.await()
                frames += notification.frame.value
            }.apply { start() }
        }
        awaitUntil(5_000, "four peers took the frame") { frames.size == 4 }
        peers.forEach(Thread::join)
        assertTrue(frames.all { it === frames.first() })
        val expected = "{\"method\":\"actions\",\"params\":{\"path\":\"/real/a.erd\"," +
            "\"actions\":[{\"type\":\"table.add\",\"payload\":{\"comment\":null}},null]}}\n"
        assertArrayEquals(expected.toByteArray(Charsets.UTF_8), notification.frame.value)

        val closed = HubNotification.DocumentClosed("/real/a.erd")
        assertEquals(
            "{\"method\":\"documentClosed\",\"params\":{\"path\":\"/real/a.erd\"}}\n",
            String(closed.frame.value, Charsets.UTF_8),
        )
        assertSame(closed.frame.value, closed.frame.value)
    }

    @Test
    fun `fails a frame that cannot be encoded on every access`() {
        val broken = HubJson.nodes.arrayNode().add(HubJson.nodes.binaryNode(byteArrayOf(1)))
        val notification = HubNotification.Actions("/real/a.erd", broken)
        assertThrows(IllegalArgumentException::class.java) { notification.frame.value }
        assertThrows(IllegalArgumentException::class.java) { notification.frame.value }
        assertTrue(!notification.frame.isInitialized())
    }

    @Test
    fun `refuses without a stack trace`() {
        val refusal = HubRequestError(HubErrorCode.NOT_OPEN, "no webview is ready")
        assertEquals(HubErrorCode.NOT_OPEN, refusal.code)
        assertEquals("no webview is ready", refusal.message)
        assertEquals(0, refusal.stackTrace.size)
        assertEquals("the IDE cannot find the file", OpenRefused("the IDE cannot find the file").message)
    }

    @Test
    fun `routes the six methods and nothing else`() {
        for (method in HubMethod.entries) assertSame(method, HubMethod.routed(method.wire))
        for (unknown in listOf("hello", "toString", "rejoin", "", "Join", "constructor")) {
            assertNull(HubMethod.routed(unknown))
        }
        assertEquals(
            listOf("openDocument", "join", "applyActions", "leave", "save"),
            HubMethod.entries.filter { it.carriesPath }.map { it.wire },
        )
    }

    @Test
    fun `keeps the production timings and lets a suite shorten them`() {
        val production = HubTimings()
        assertEquals(1_000L, production.publishWaitMs)
        assertEquals(1_000L, production.initialValueHoldMs)
        assertEquals(500L, production.joinQuietCapMs)
        assertEquals(2_000L, production.saveQuietCapMs)
        assertEquals(5_000L, production.openReadyTimeoutMs)
        assertEquals(200L, production.replicaDebounceMs)
        assertEquals(1_000L, production.drainCapMs)
        assertEquals(1_000L, production.closeBoundMs)
        assertEquals(500L, production.registryCallBoundMs)
        assertEquals(500L, production.threadJoinBoundMs)
        assertEquals(10_000L, production.saveWriteBoundMs)
        assertEquals(200L, production.foldersDebounceMs)

        val short = HubTimings(
            publishWaitMs = 200, initialValueHoldMs = 200, joinQuietCapMs = 150, saveQuietCapMs = 300,
            openReadyTimeoutMs = 400, replicaDebounceMs = 20, drainCapMs = 200, closeBoundMs = 300,
            registryCallBoundMs = 100, threadJoinBoundMs = 100, saveWriteBoundMs = 300, foldersDebounceMs = 20,
        )
        assertEquals(150L, short.joinQuietCapMs)
        assertNotSame(production, short)
        assertEquals(production, short.copy(
            publishWaitMs = 1_000, initialValueHoldMs = 1_000, joinQuietCapMs = 500, saveQuietCapMs = 2_000,
            openReadyTimeoutMs = 5_000, replicaDebounceMs = 200, drainCapMs = 1_000, closeBoundMs = 1_000,
            registryCallBoundMs = 500, threadJoinBoundMs = 500, saveWriteBoundMs = 10_000, foldersDebounceMs = 200,
        ))
    }

    @Test
    fun `logs a line with or without a detail`() {
        val log = RecordingLog()
        val error = IllegalStateException("boom")
        log.warn("request failed", error)
        log.warn("could not write /home/user/.erd-editor/ide/4242.json")
        val lock = "could not write /home/user/.erd-editor/ide/4242.json"
        assertEquals(listOf("request failed" to error, lock to null), log.lines)
        assertEquals(listOf("request failed", lock), log.texts)
        log.clear()
        assertEquals(emptyList<String>(), log.texts)
        assertEquals("[erd-editor hub]", HUB_LOG_PREFIX)
    }
}
