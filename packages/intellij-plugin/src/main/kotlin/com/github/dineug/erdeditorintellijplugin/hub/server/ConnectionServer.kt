package com.github.dineug.erdeditorintellijplugin.hub.server

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.FrameDecoder
import com.github.dineug.erdeditorintellijplugin.hub.FrameException
import com.github.dineug.erdeditorintellijplugin.hub.HUB_PROTOCOL_VERSION
import com.github.dineug.erdeditorintellijplugin.hub.HubErrorCode
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubMethod
import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.github.dineug.erdeditorintellijplugin.hub.HubRequestError
import com.github.dineug.erdeditorintellijplugin.hub.HubTexts
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import com.github.dineug.erdeditorintellijplugin.hub.encodeFrame
import com.github.dineug.erdeditorintellijplugin.hub.rethrowIfCancellation
import com.github.dineug.erdeditorintellijplugin.hub.transport.HubChannel
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.CompletableFuture
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/** What a connection answers a hello with, and hands every request to once the hello passed. */
class ServeOptions(
    val token: String,
    val ide: String,
    val version: String,
    val handler: HubHandler,
    /** The real path to hand the handler, or throws HubRequestError; it blocks, on the serving loop's io thread. */
    val authorize: (String) -> String,
    /** Numbers the peers whose hello passed, from 1. */
    val nextConnectionId: () -> Int,
    val threads: HubThreads,
    val log: HubLog,
)

/** A connection over channel that serves once start is called, as packages/agent-hub-host's server.ts serves a socket. */
fun serveConnection(channel: HubChannel, options: ServeOptions): ServedConnection = ServedConnection(channel, options)

/**
 * One accepted connection: a reader, a serving loop and a writer apart, so a write that cannot reach
 * the peer leaves it served and a hang-up destroys the channel even once reading failed. Frames pass
 * authorization in arrival order, handlers start on the registry thread in that order, and a batch
 * holds every frame behind it until it is answered, so one peer's edits land in its own order.
 */
class ServedConnection internal constructor(private val channel: HubChannel, private val options: ServeOptions) {
    private sealed interface Outbound {
        class Frame(val bytes: ByteArray) : Outbound

        /** A graceful end once the frames before it are out. */
        object End : Outbound

        /** A hang-up once the frames before it are out. */
        object Destroy : Outbound
    }

    private sealed interface Outcome

    private class Answered(val result: HandlerResult) : Outcome

    private class Refused(val code: HubErrorCode, val message: String) : Outcome

    private class Hello(val id: Double, val token: JsonNode?, val protocolVersion: Double, val client: String)

    private class Drain(val target: Long, val future: CompletableFuture<Unit>)

    private val threads = options.threads
    private val log = options.log

    /**
     * Guards open, ended, destroyed, queued, written, writing and drains: the reader, the serving loop,
     * the registry thread, the writer and a host's shutdown all touch them, where the TypeScript
     * server keeps them on one thread. open and destroyed are volatile for the checks outside it.
     */
    private val lock = ReentrantLock()

    @Volatile
    private var open = true

    /** An End or a Destroy is queued, so nothing more is. */
    private var ended = false

    /** The hub stopped: nothing more is written, and a failing write is no news. */
    @Volatile
    private var destroyed = false
    private var queued = 0L
    private var written = 0L
    private var writing = true
    private val drains = ArrayList<Drain>()
    private val outbound = LinkedBlockingQueue<Outbound>()

    /** The writer's own: after the first failed write the channel is gone, as Node destroys a socket. */
    private var failed = false

    private val decoder = FrameDecoder()
    private val incoming = Channel<JsonNode>(Channel.UNLIMITED)

    /** Frames read and not yet taken up by the serving loop. */
    private val unprocessed = AtomicInteger()

    /** Handler calls and the loop's own answers posted to the registry thread and not yet finished. */
    private val inFlight = AtomicInteger()

    /** The loop's own; the peer whose hello passed. */
    private var connection: Peer? = null

    @Volatile
    private var servingLoop: Job? = null

    /** Reading and writing, the two users of the channel, which is closed once both ended. */
    private val channelUsers = AtomicInteger(2)

    /** The reader, the serving loop and the writer, which finished waits for. */
    private val parts = AtomicInteger(3)

    /** Completes once the reader, the serving loop and the writer all ended. */
    val finished: CompletableFuture<Unit> = CompletableFuture()

    /** Starts reading and writing on io and launches the serving loop. */
    fun start() {
        servingLoop = threads.scope.launch(threads.io) { serve() }.also { it.invokeOnCompletion { partEnded() } }
        val reading = submit(::readLoop)
        val writing = submit(::writeLoop)
        if (reading && writing) return
        // The hub's threads have stopped: nothing will serve this peer.
        destroyNow()
        if (!reading) readerFinished()
        if (!writing) writerFinished()
    }

    /** Destroys the channel once the frames already queued are out. */
    fun hangUp() {
        lock.withLock {
            open = false
            endWith(Outbound.Destroy)
        }
    }

    /** The hub stops: the channel is destroyed now, and a frame still queued is dropped. */
    fun destroyNow() {
        lock.withLock {
            open = false
            destroyed = true
            ended = true
            outbound.put(Outbound.Destroy)
        }
        channel.destroy()
        servingLoop?.cancel()
    }

    /**
     * No frame read and not yet served, no answer still to come and nothing queued unwritten: once
     * the channel also waits in a read, what the peer got is final. For the suites.
     */
    internal fun isQuiet(): Boolean =
        unprocessed.get() == 0 && inFlight.get() == 0 && lock.withLock { if (ended) !writing else written >= queued }

    private fun submit(part: () -> Unit): Boolean = try {
        threads.ioExecutor.execute(part)
        true
    } catch (e: RejectedExecutionException) {
        false
    }

    private fun readLoop() {
        val buffer = ByteArray(READ_BYTES)
        try {
            while (true) {
                val count = channel.read(buffer)
                if (count < 0) return
                val frames = try {
                    decoder.feed(buffer, 0, count)
                } catch (e: FrameException) {
                    log.warn("hung up on a peer that sent a malformed frame", e)
                    hangUp()
                    return
                }
                // After an end the loop skips them, and reading goes on until the peer's EOF.
                for (frame in frames) {
                    unprocessed.incrementAndGet()
                    incoming.trySend(frame)
                }
            }
        } catch (e: IOException) {
            // A peer hanging up is the usual end of a connection and says nothing.
        } finally {
            readerFinished()
        }
    }

    /** The connection stops serving at once when reading ends, even with a request in flight. */
    private fun readerFinished() {
        lock.withLock { open = false }
        decoder.end()
        incoming.close()
        channelUserEnded()
        partEnded()
    }

    private suspend fun serve() {
        try {
            for (frame in incoming) {
                try {
                    if (open) {
                        val peer = connection
                        if (peer == null) connection = authenticate(frame) else route(frame, peer)
                    }
                } finally {
                    unprocessed.decrementAndGet()
                }
            }
        } finally {
            lock.withLock {
                open = false
                endWith(Outbound.End)
            }
            connection?.let { peer -> threads.post { options.handler.disconnect(peer) } }
        }
    }

    /** The first frame must be a hello with the lock's token and this protocol; the answers stay inline. */
    private fun authenticate(frame: JsonNode): Peer? {
        val hello = helloOf(frame)
        if (hello == null) {
            log.warn("hung up on a peer whose first frame was not a hello")
            hangUp()
            return null
        }
        if (!tokenMatches(hello.token)) {
            log.warn("refused a hello with a token that is not in the lock file")
            refuseHello(HubResults.errorResponse(hello.id, HELLO, HubErrorCode.UNAUTHORIZED, HubTexts.UNAUTHORIZED))
            return null
        }
        val client = hello.protocolVersion
        val hub = HUB_PROTOCOL_VERSION.toDouble()
        if (client != hub) {
            log.warn("refused a hello speaking protocol ${HubJson.jsNumber(client)}")
            refuseHello(
                HubResults.errorResponse(
                    hello.id, HELLO, HubErrorCode.PROTOCOL_MISMATCH, HubTexts.protocolMismatch(hub, client), hub, client,
                ),
            )
            return null
        }
        send(encodeFrame(HubResults.response(hello.id, HELLO, HubResults.hello(options.ide, options.version))))
        return Peer(options.nextConnectionId(), hello.client)
    }

    /**
     * The hello of a first frame, read by hand as server.ts's helloOf reads a refused one: an object
     * with method hello and an integer id; params {} unless an object, a protocol that is no number
     * reads as 0 and a client that is no string as the empty name. The token is checked as it stands.
     */
    private fun helloOf(frame: JsonNode): Hello? {
        if (!HubJson.isRecord(frame) || frame.get("method")?.textValue() != HELLO) return null
        val id = frame.get("id")?.takeIf(HubJson::isJsInteger) ?: return null
        val params = frame.get("params")?.takeIf(HubJson::isRecord)
        return Hello(
            id = id.asDouble(),
            token = params?.get("token"),
            protocolVersion = params?.get("protocolVersion")?.takeIf(JsonNode::isNumber)?.asDouble() ?: 0.0,
            client = params?.get("client")?.takeIf(JsonNode::isTextual)?.textValue() ?: "",
        )
    }

    /** Constant time over the bytes, so how long a refusal takes leaks no prefix of the token. */
    private fun tokenMatches(token: JsonNode?): Boolean =
        token != null && token.isTextual &&
            MessageDigest.isEqual(token.textValue().toByteArray(Charsets.UTF_8), options.token.toByteArray(Charsets.UTF_8))

    /** The refusal goes out, then the stream ends gracefully rather than being destroyed. */
    private fun refuseHello(json: String) {
        val frame = encodeFrame(json)
        lock.withLock {
            offer(frame)
            open = false
            endWith(Outbound.End)
        }
    }

    /**
     * A frame after hello, read by hand as the combined answers of server.ts's schema and refused
     * paths: skipped without an integer id, badRequest for an unknown method or a param the method
     * needs, all before any authorization; else dispatched with what it carries.
     */
    private suspend fun route(frame: JsonNode, peer: Peer) {
        val fields = frame.takeIf(HubJson::isRecord)
        val method = fields?.get("method")?.takeIf(JsonNode::isTextual)?.textValue() ?: ""
        val params = fields?.get("params")?.takeIf(HubJson::isRecord) as ObjectNode? ?: HubJson.nodes.objectNode()
        val id = fields?.get("id")
        if (!HubJson.isJsInteger(id)) {
            later { log.warn("ignored a ${HubJson.quote(method)} frame without an id: a peer sends requests only") }
            return
        }
        val requestId = id!!.asDouble()
        val routed = HubMethod.routed(method)
        // listDocuments is never authorized, whatever it carries.
        val path = params.get("path")?.takeIf { routed?.carriesPath == true && it.isTextual }?.textValue()
        val actions = params.get("actions") as? ArrayNode
        val problem = when {
            routed == null -> HubTexts.noMethod(method)
            routed.carriesPath && path == null -> HubTexts.needsPath(method)
            routed == HubMethod.APPLY_ACTIONS && actions == null -> HubTexts.NEEDS_ACTIONS
            else -> null
        }
        if (problem != null) {
            later { respond(requestId, method, Refused(HubErrorCode.BAD_REQUEST, problem)) }
            return
        }
        dispatch(requestId, routed!!, params, path, actions, peer)
    }

    /**
     * Authorizes the path a request names, inline, then starts its handler on the registry thread,
     * detached: a peer that leaves never cancels a save or an open that is already writing, it only
     * loses the answer. A batch holds the loop until it is answered; any other request does not.
     */
    private suspend fun dispatch(
        id: Double,
        method: HubMethod,
        params: ObjectNode,
        path: String?,
        actions: ArrayNode?,
        peer: Peer,
    ) {
        val real = if (path == null) {
            null
        } else {
            try {
                options.authorize(path)
            } catch (e: Throwable) {
                e.rethrowIfCancellation()
                later { respond(id, method.wire, refusalOf(e)) }
                return
            }
        }
        if (!open) return

        inFlight.incrementAndGet()
        val job = threads.scope.launch(threads.registry) {
            val outcome = try {
                Answered(call(method, params, real, actions, peer))
            } catch (e: Throwable) {
                e.rethrowIfCancellation()
                refusalOf(e)
            }
            respond(id, method.wire, outcome)
            (outcome as? Answered)?.result?.afterResponse?.invoke()
        }
        job.invokeOnCompletion { inFlight.decrementAndGet() }
        if (method == HubMethod.APPLY_ACTIONS) job.join()
    }

    private suspend fun call(
        method: HubMethod,
        params: ObjectNode,
        real: String?,
        actions: ArrayNode?,
        peer: Peer,
    ): HandlerResult {
        val handler = options.handler
        return when (method) {
            HubMethod.LIST_DOCUMENTS -> handler.listDocuments(params, peer)
            HubMethod.OPEN_DOCUMENT -> handler.openDocument(
                OpenParams(
                    path = real!!,
                    create = HubJson.isTruthy(params.get("create")),
                    initialValue = params.get("initialValue")?.takeIf(JsonNode::isTextual)?.textValue(),
                ),
                peer,
            )
            HubMethod.JOIN -> handler.join(PathParams(real!!), peer)
            HubMethod.APPLY_ACTIONS -> handler.applyActions(ApplyParams(real!!, actions!!), peer)
            HubMethod.LEAVE -> handler.leave(PathParams(real!!), peer)
            HubMethod.SAVE -> handler.save(PathParams(real!!), peer)
        }
    }

    /**
     * The loop's own answers go to the registry thread behind every handler started before them, as
     * server.ts answers a handler that never suspends before it looks at the next frame.
     */
    private fun later(block: () -> Unit) {
        inFlight.incrementAndGet()
        threads.post {
            try {
                block()
            } finally {
                inFlight.decrementAndGet()
            }
        }
    }

    /**
     * Logs a refusal, then writes the answer; a result that cannot be framed, too large or too deep,
     * is answered internal instead. Dropped once the connection stopped serving.
     */
    private fun respond(id: Double, method: String, outcome: Outcome) {
        if (outcome is Refused) log.warn("answered $method with ${outcome.code.wire}", detailOf(outcome))
        if (!open) return
        val frame = try {
            encodeFrame(render(id, method, outcome))
        } catch (e: Exception) {
            unframeable(id, method, e)
        } catch (e: StackOverflowError) {
            unframeable(id, method, e)
        }
        send(frame)
    }

    private fun render(id: Double, method: String, outcome: Outcome): String = when (outcome) {
        is Answered -> HubResults.response(id, method, outcome.result.result)
        is Refused -> HubResults.errorResponse(id, method, outcome.code, outcome.message)
    }

    private fun unframeable(id: Double, method: String, error: Throwable): ByteArray {
        val refusal = refusalOf(error)
        return encodeFrame(HubResults.errorResponse(id, method, refusal.code, refusal.message))
    }

    /** A HubRequestError answers its own code; anything else is logged and answered internal. */
    private fun refusalOf(error: Throwable): Refused {
        if (error is HubRequestError) return Refused(error.code, error.message.orEmpty())
        error.rethrowIfCancellation()
        log.warn("request failed", error)
        return Refused(HubErrorCode.INTERNAL, describe(error))
    }

    private fun detailOf(refused: Refused): ObjectNode =
        HubJson.nodes.objectNode().put("code", refused.code.wire).put("message", refused.message)

    private fun send(frame: ByteArray) {
        lock.withLock { offer(frame) }
    }

    /** Under the lock: queues frame unless the connection stopped serving or an end is queued; counted only then. */
    private fun offer(frame: ByteArray) {
        if (!open || ended) return
        queued++
        outbound.put(Outbound.Frame(frame))
    }

    /** Under the lock: queues the end, once; every frame queued before it goes out first. */
    private fun endWith(end: Outbound) {
        if (ended) return
        ended = true
        outbound.put(end)
    }

    private fun end() {
        lock.withLock {
            open = false
            endWith(Outbound.End)
        }
    }

    private fun drain(): CompletableFuture<Unit> = lock.withLock {
        if (!writing || written >= queued) return CompletableFuture.completedFuture(Unit)
        CompletableFuture<Unit>().also { drains += Drain(queued, it) }
    }

    private fun writeLoop() {
        try {
            while (true) {
                when (val item = outbound.take()) {
                    is Outbound.Frame -> {
                        write(item.bytes)
                        settle { written++ }
                    }
                    Outbound.End -> {
                        if (!destroyed) channel.shutdownOutput()
                        return
                    }
                    Outbound.Destroy -> {
                        channel.destroy()
                        return
                    }
                }
            }
        } catch (e: InterruptedException) {
            // The hub's threads are shutting down, and the channel goes with them.
            channel.destroy()
        } finally {
            writerFinished()
        }
    }

    /**
     * Writes one frame. The first failure is logged once and the channel counts as gone, as Node
     * destroys a socket on a write error; every later frame counts as written, unwritten and silent.
     */
    private fun write(bytes: ByteArray) {
        if (failed || destroyed) return
        try {
            channel.write(bytes)
        } catch (e: Exception) {
            failed = true
            if (!destroyed) log.warn("could not write to a peer", e)
        }
    }

    /** Taken or refused, a frame counts as written, so a drain never outlasts a peer the hub can no longer write to. */
    private fun writerFinished() {
        settle {
            writing = false
            written = queued
        }
        channelUserEnded()
        partEnded()
    }

    /** Applies change under the lock, then completes every drain it satisfied, outside the lock. */
    private inline fun settle(change: () -> Unit) {
        val settled = lock.withLock {
            change()
            val done = drains.filter { !writing || it.target <= written }
            drains.removeAll(done)
            done
        }
        settled.forEach { it.future.complete(Unit) }
    }

    private fun channelUserEnded() {
        if (channelUsers.decrementAndGet() == 0) channel.close()
    }

    private fun partEnded() {
        if (parts.decrementAndGet() == 0) finished.complete(Unit)
    }

    /** The authenticated peer handlers see, the same object for every call and for disconnect. */
    private inner class Peer(override val id: Int, override val client: String) : HubConnection {
        /** One frame for every peer of a batch; one that cannot be framed is logged and dropped, never thrown. */
        override fun notify(notification: HubNotification) {
            if (!open) return
            val frame = try {
                notification.frame.value
            } catch (e: Exception) {
                e.rethrowIfCancellation()
                log.warn("request failed", e)
                return
            } catch (e: StackOverflowError) {
                log.warn("request failed", e)
                return
            }
            send(frame)
        }

        override fun drain(): CompletableFuture<Unit> = this@ServedConnection.drain()

        override fun end() = this@ServedConnection.end()

        override fun toString(): String = "HubConnection(id=$id, client=${HubJson.quote(client)})"
    }

    private companion object {
        const val HELLO = "hello"
        const val READ_BYTES = 64 * 1024

        /** JavaScript's String(error): the name, then the message when there is one. */
        fun describe(error: Throwable): String {
            val name = error.javaClass.simpleName.ifEmpty { error.javaClass.name }
            val message = error.message
            return if (message.isNullOrEmpty()) name else "$name: $message"
        }
    }
}
