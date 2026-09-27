package com.github.dineug.erdeditorintellijplugin.hub.server

import com.fasterxml.jackson.databind.JsonNode
import com.github.dineug.erdeditorintellijplugin.hub.HubErrorCode
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubMethod
import com.github.dineug.erdeditorintellijplugin.hub.HubRequestError
import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import com.github.dineug.erdeditorintellijplugin.hub.testing.CorpusRefusal
import com.github.dineug.erdeditorintellijplugin.hub.testing.MemoryChannel
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingHandler
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.ScenarioCall
import com.github.dineug.erdeditorintellijplugin.hub.testing.ScenarioEnd
import com.github.dineug.erdeditorintellijplugin.hub.testing.ServerScenario
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Every connection scenario of packages/agent-hub-host's conformance corpus, which the TypeScript
 * hub is held to as well: the frames written, how the connection was left, the paths authorize was
 * handed, the handler calls and the log texts. Each piece is sent once the hub is idle, as the
 * corpus says: every frame read so far served, answered and written, and the channel read again.
 */
@RunWith(Parameterized::class)
class ConnectionScenarioTest(private val scenario: ServerScenario) {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    @get:Rule
    val testThreads = TestThreads()

    private val server = Corpus.host.server
    private val log = RecordingLog()

    @Test
    fun `serves the scenario as the TypeScript hub does`() {
        val handler = RecordingHandler()
        for (method in HubMethod.entries) {
            val refusal = scenario.handlerRefuses[method.wire]
            handler.answer(method) { params, _ ->
                if (refusal != null) throw refusal.toError()
                HandlerResult(answerOf(method, params))
            }
        }
        val authorized = CopyOnWriteArrayList<String>()
        val authorize = { path: String ->
            authorized += path
            server.authorizeRefuses[path]?.let { throw it.toError() }
            server.authorizePrefix + path
        }
        val channel = MemoryChannel()
        val options = ServeOptions(
            server.token, server.ide, server.version, handler, authorize, AtomicInteger()::incrementAndGet,
            testThreads.create(log), log,
        )
        val served = serveConnection(channel, options).apply { start() }
        try {
            for (piece in scenario.send) {
                channel.sendText(piece)
                awaitIdle(channel, served)
            }

            assertEquals(scenario.expect, channel.received)
            assertEquals(scenario.then, endOf(channel))
            assertEquals(scenario.authorized, authorized.toList())
            assertEquals(scenario.calls, handler.calls.map(::normalize))
            assertEquals(scenario.logs, log.texts)
        } finally {
            served.destroyNow()
            served.finished.get(5, TimeUnit.SECONDS)
        }
    }

    /** answers[method], with openDocument's path first, the one the handler was handed. */
    private fun answerOf(method: HubMethod, params: Any) = if (method == HubMethod.OPEN_DOCUMENT) {
        HubJson.nodes.objectNode().put("path", (params as OpenParams).path).also {
            it.setAll<JsonNode>(server.answers.getValue(method.wire))
        }
    } else {
        server.answers.getValue(method.wire)
    }

    private fun normalize(call: RecordingHandler.Call): ScenarioCall {
        val params = call.params
        return ScenarioCall(
            method = call.method.wire,
            path = when (params) {
                is OpenParams -> params.path
                is PathParams -> params.path
                is ApplyParams -> params.path
                else -> null
            },
            create = (params as? OpenParams)?.create,
            initialValue = (params as? OpenParams)?.initialValue,
            actions = (params as? ApplyParams)?.actions,
            client = call.connection.client,
        )
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun scenarios(): List<ServerScenario> = Corpus.host.server.scenarios

        /** The corpus's then: destroyed is a hang-up, an ended output a graceful end. */
        fun endOf(channel: MemoryChannel): ScenarioEnd = when {
            channel.isDestroyed -> ScenarioEnd.HANG_UP
            channel.isOutputShutdown -> ScenarioEnd.END
            else -> ScenarioEnd.OPEN
        }

        /** Waits until the hub served what it read and reads again, or reads no more. */
        fun awaitIdle(channel: MemoryChannel, served: ServedConnection) {
            awaitUntil(5_000, "the hub idle") {
                (channel.isReadWaiting || channel.isReadEnded || channel.isDestroyed) && served.isQuiet()
            }
        }

        fun CorpusRefusal.toError(): HubRequestError =
            HubRequestError(HubErrorCode.entries.single { it.wire == code }, message)
    }
}
