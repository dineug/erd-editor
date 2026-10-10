package com.github.dineug.erdeditorintellijplugin.hub.document

import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.AuthScope
import com.github.dineug.erdeditorintellijplugin.hub.Authz
import com.github.dineug.erdeditorintellijplugin.hub.HubErrorCode
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.HubRequestError
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.server.HandlerResult
import com.github.dineug.erdeditorintellijplugin.hub.server.HubConnection
import com.github.dineug.erdeditorintellijplugin.hub.server.PathParams
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeClock
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeDocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeFileSystem
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeIdeFacade
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeView
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.fail

/** The document suites' short waits, with margins; the texts keep the production numbers. */
val DOCUMENT_TIMINGS = HubTimings(
    joinQuietCapMs = 150,
    saveQuietCapMs = 300,
    openReadyTimeoutMs = 400,
    saveWriteBoundMs = 300,
)

/**
 * For a quiet wait the test itself ends with a save: caps no loaded runner reaches first, so a check
 * that the wait still holds cannot race them, and the passing run never waits them out.
 */
val PATIENT_TIMINGS = DOCUMENT_TIMINGS.copy(joinQuietCapMs = 10_000, saveQuietCapMs = 10_000)

/** The workspace folder every harness lists in its scope. */
const val WS = "/ws"

/**
 * A registry and its handler over a FakeEnvironment, as Obsidian's createHubHarness: files live in
 * the fake's memory tree, links map a path onto its real one, and FakeViews stand in for editors.
 * The clock stands still at 1000 until a test moves it, so a peer batch's replica bound is explicit.
 */
class DocumentHarness(
    val threads: HubThreads,
    val log: RecordingLog,
    val timings: HubTimings = DOCUMENT_TIMINGS,
    val platform: HubPlatform = HubPlatform.LINUX,
    withHub: Boolean = true,
) {
    val clock = FakeClock(1_000.0)
    val env = FakeEnvironment(platform = platform, clock = clock)
    val fs: FakeFileSystem get() = env.fs
    val authz = Authz(env)
    val registry = DocumentRegistry(platform, authz.takeIf { withHub }, threads, clock, log, timings, env.fs)
    val ide = FakeIdeFacade()

    @Volatile
    var scope: AuthScope = AuthScope(listOf(WS), emptyList())
    val handler = HubRequestHandler(registry, ide, env, authz, { scope }, threads, log, timings)

    private var views = 0

    /** One editor of a file. */
    class Opened(val file: FakeDocumentFile, val view: FakeView)

    init {
        fs.addDir(WS)
        ide.projects = listOf(ProjectTrust(listOf(WS), trusted = true))
    }

    fun addFile(path: String, text: String = "{}") = fs.addFile(path, text)

    /** Runs block on the registry thread and waits for it; a failure comes back as thrown. */
    fun <T> onRegistry(block: suspend DocumentRegistry.() -> T): T = runBlocking(threads.registry) { registry.block() }

    /** The document at path; fails when none is. */
    fun entry(path: String): DocumentEntry = onRegistry { checkNotNull(find(path)) { "no document at $path" } }

    /** An editor opening a file, not ready yet; text, when given, is written to the file first. */
    fun open(path: String, text: String? = null): Opened {
        text?.let { addFile(path, it) }
        return add(FakeDocumentFile(path))
    }

    /** Another editor of a file already open, as a split or a second window shows it. */
    fun add(file: FakeDocumentFile): Opened {
        val view = FakeView("view ${++views}").attach(registry, file, threads)
        onRegistry { addView(file, view) }
        return Opened(file, view)
    }

    /** The page asked for its initial value; waits until the registry readied it on a resolved path. */
    fun ready(opened: Opened, disk: String = fs.textOf(opened.file.localPath) ?: ""): Opened {
        onRegistry { onViewReady(opened.file, opened.view, disk) }
        awaitReady(opened)
        return opened
    }

    fun awaitReady(opened: Opened) {
        awaitUntil(message = "${opened.view} ready") {
            onRegistry { documents().any { it.file === opened.file && it.resolved && opened.view in it.ready } }
        }
    }

    fun openReady(path: String, text: String? = null): Opened = ready(open(path, text))

    /** The page's shared store emitted actions; returns once the registry handled them. */
    fun relay(opened: Opened, actions: String) {
        opened.view.relay(batch(actions))
        onRegistry {}
    }

    /** The page's replica saved value, null for a change that left it as it was, and handed runtime with it. */
    fun save(opened: Opened, value: String?, runtime: String? = null) =
        onRegistry { onValueSaved(opened.file, opened.view, value, runtime) }

    /** Runs a handler method on the registry thread, as the connection server does, and waits for it. */
    fun <T> call(block: suspend HubRequestHandler.() -> T): T = runBlocking(threads.registry) { handler.block() }

    /** Starts a handler method on the registry thread without waiting for it. */
    fun <T> start(block: suspend HubRequestHandler.() -> T): Deferred<T> =
        threads.scope.async(threads.registry) { handler.block() }

    /** A join as the server runs it: the answer, then its follow-up in the same registry step. */
    fun join(path: String, connection: HubConnection): ObjectNode = call { respond(join(PathParams(path), connection)) }

    fun startJoin(path: String, connection: HubConnection): Deferred<ObjectNode> =
        start { respond(join(PathParams(path), connection)) }

    private fun respond(result: HandlerResult): ObjectNode {
        result.afterResponse?.invoke()
        return result.result
    }
}

/** The document at path, from inside a registry step. */
fun DocumentRegistry.entryAt(path: String): DocumentEntry = checkNotNull(find(path)) { "no document at $path" }

/** A table.add action, or another type, with its version when given, written as JSON. */
fun add(version: Int?, type: String = "table.add"): String {
    val versioned = if (version == null) "" else ",\"version\":$version"
    return "{\"type\":\"$type\",\"payload\":{}$versioned}"
}

/** A JSON array of actions: "[a,b]" from add(...) pieces, or already bracketed text. */
fun batch(actions: String): ArrayNode =
    HubJson.parse(if (actions.startsWith("[")) actions else "[$actions]") as ArrayNode

fun batchOf(vararg actions: String): String = actions.joinToString(",", "[", "]")

fun <T> Deferred<T>.get(timeoutMs: Long = 5_000): T = runBlocking { withTimeout(timeoutMs) { await() } }

fun ObjectNode.json(): String = HubJson.stringify(this)

/** Asserts block throws a HubRequestError with code, and message when given; returns it. */
fun assertRefusal(code: HubErrorCode, message: String? = null, block: () -> Unit): HubRequestError {
    try {
        block()
    } catch (e: HubRequestError) {
        assertEquals(code, e.code)
        if (message != null) assertEquals(message, e.message)
        return e
    }
    fail("expected a $code refusal")
    throw AssertionError()
}
