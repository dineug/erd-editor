package com.github.dineug.erdeditorintellijplugin.hub.document

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.AuthScope
import com.github.dineug.erdeditorintellijplugin.hub.Authz
import com.github.dineug.erdeditorintellijplugin.hub.HubClock
import com.github.dineug.erdeditorintellijplugin.hub.HubFileSystem
import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.github.dineug.erdeditorintellijplugin.hub.HubPaths
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.NioFileSystem
import com.github.dineug.erdeditorintellijplugin.hub.server.HubConnection
import com.github.dineug.erdeditorintellijplugin.hub.server.HubDocuments
import com.github.dineug.erdeditorintellijplugin.hub.server.HubNotification
import com.github.dineug.erdeditorintellijplugin.hub.server.HubPublisher
import com.github.dineug.erdeditorintellijplugin.hub.server.HubResults
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.nio.file.NoSuchFileException
import java.util.Collections
import java.util.IdentityHashMap
import java.util.WeakHashMap
import java.util.concurrent.ScheduledFuture
import kotlin.math.ceil

/** One ERD file with the editors showing it and the agent peers that joined it. Registry thread only. */
class DocumentEntry internal constructor(val file: DocumentFile) {
    /** The real path once resolved, the local one before; handlers and peers address the document by it. */
    var path: String
    var resolved: Boolean = false

    /** Bumped by a rename or move, so a realpath step of the old path lands nowhere. */
    var generation: Int = 0

    /** file.localPath when last resolved; a change means the file was renamed or moved. */
    var localPath: String

    /** Every editor of the file in the order it opened; the first writes the file for save. */
    val views: MutableList<HubView> = ArrayList()

    /** The editors whose page holds its initial value, the only ones anything is injected into. */
    val ready: MutableSet<HubView> = LinkedHashSet()
    val peers: MutableMap<HubConnection, JoinPeer> = LinkedHashMap()
    var observedVersion: Double = 0.0
    var quiet: QuietState<HubView> = QuietState()

    /** The document as the first editor loaded it or a replica last saved it; save reads it on the EDT. */
    @Volatile
    var content: String? = null

    /** What an editor last wrote to the file; the dirty flag compares the content against it. */
    var lastWritten: String? = null

    /** Completed once the lock lists the document, or at once with no hub to list it. */
    val listed: CompletableDeferred<Unit> = CompletableDeferred()

    init {
        val local = file.localPath
        path = local
        localPath = local
    }
}

/** How a wait for a ready editor ended. */
sealed interface ReadyOutcome {
    data class Ready(val entry: DocumentEntry) : ReadyOutcome

    data object TimedOut : ReadyOutcome

    /** Cancelled by the caller, or by a shutdown, which openDocument answers as the plugin turning off. */
    data object Cancelled : ReadyOutcome

    /** The IDE's open threw; the error is the reason the refusal names. */
    data class OpenFailed(val error: Throwable) : ReadyOutcome
}

/** An openDocument's wait for a ready editor of one path, resolved once. Registry thread only. */
class ReadyWait internal constructor(internal val path: String, private val done: (ReadyWait) -> Unit) {
    private val outcome = CompletableDeferred<ReadyOutcome>()

    suspend fun await(): ReadyOutcome = outcome.await()

    fun cancel() = resolve(ReadyOutcome.Cancelled)

    /** The open the caller started threw: the wait ends at once instead of at its timeout. */
    fun failOpen(error: Throwable) = resolve(ReadyOutcome.OpenFailed(error))

    internal fun resolve(value: ReadyOutcome) {
        if (outcome.complete(value)) done(this)
    }
}

/** A join's answer and what ends its window once the answer is on its way. */
class JoinOutcome(val result: ObjectNode, val afterResponse: () -> Unit)

/**
 * Every ERD file open in an editor, its editors and the agent peers that joined it, from plugin load
 * on, whether or not the hub listens: Obsidian's registry, with the IDE's rules. There is one way to
 * a peer, deliver, and one way into editors, injectToViews. Every method runs on the registry thread
 * except post, call and callBlocking. fs is what a join reads a file no editor has loaded yet with:
 * the hub environment's, NioFileSystem by default.
 */
class DocumentRegistry(
    private val platform: HubPlatform,
    private val authz: Authz?,
    private val threads: HubThreads,
    private val clock: HubClock,
    private val log: HubLog,
    private val timings: HubTimings = HubTimings(),
    private val fs: HubFileSystem = NioFileSystem,
) : HubDocuments {
    private val entries = LinkedHashMap<DocumentFile, DocumentEntry>()
    private val readyWaiters = LinkedHashSet<ReadyWait>()

    /** The paths each peer joined, registered or read from disk, which a shutdown or a revoke closes. */
    private val tracked = LinkedHashMap<HubConnection, MutableList<String>>()

    /** The paths closed for a connection since it last tracked one, which decide whether a revoke ends it. */
    private val recentlyClosed = HashMap<HubConnection, MutableList<String>>()

    /**
     * Connections the server let go of. A join reads trust before it registers, so its peer can hang
     * up first: what a request still in flight asks for such a connection registers nothing.
     */
    private val gone: MutableSet<HubConnection> = Collections.newSetFromMap(WeakHashMap())

    /** The pending seeding step of each view, so a reload or a close drops it. */
    private val readying = IdentityHashMap<HubView, Any>()
    private var publisher: HubPublisher? = null
    private var active: DocumentEntry? = null

    /** The scope of the last revoke; null until the first, when every path counts as authorized. */
    private var lastScope: AuthScope? = null

    /** True once shutdown ran: no peer registers after it. */
    @Volatile
    var isShutDown: Boolean = false
        private set

    /** Runs block on the registry thread after every step queued before it. */
    fun post(block: DocumentRegistry.() -> Unit) = threads.post { block() }

    suspend fun <T> call(block: suspend DocumentRegistry.() -> T): T = withContext(threads.registry) { block() }

    /** For the EDT's bounded waits: null on timeout, after shutdown and on a failure (logged). */
    fun <T> callBlocking(timeoutMs: Long, block: DocumentRegistry.() -> T): T? =
        threads.callBlocking(timeoutMs) { block() }

    /** Publishes the documents already open, then every change to them; ignored after shutdown. */
    override fun setPublisher(publisher: HubPublisher?) = post {
        if (!isShutDown) this.publisher = publisher
        publish()
    }

    /** Keeps a document at once, or one already kept, so its editors work before the hub does. */
    fun register(file: DocumentFile) {
        if (entries.containsKey(file)) return
        val entry = DocumentEntry(file)
        entries[file] = entry
        resolve(entry)
    }

    fun addView(file: DocumentFile, view: HubView) {
        register(file)
        val entry = entries.getValue(file)
        if (view !in entry.views) entry.views += view
    }

    /**
     * The view's page asked for its initial value, so it holds nothing until it has one. One step
     * seeds and readies it: once the document is quiet (a join's wait), it picks the mirror or
     * diskValue, sends it and marks the view ready without suspending, so every later batch follows it.
     */
    fun onViewReady(file: DocumentFile, view: HubView, diskValue: String) {
        val entry = entries[file] ?: return
        if (view !in entry.views) return
        entry.ready.remove(view)
        JoinWindow.dropRecipient(entry.quiet, view)
        val token = Any()
        readying[view] = token
        threads.scope.launch(threads.registry, CoroutineStart.UNDISPATCHED) {
            if (entry.content != null) {
                JoinWindow.waitUntilQuiet(entry.quiet, timings.joinQuietCapMs, clock)
                if (readying[view] !== token) return@launch
            }
            readying.remove(view)
            val value = entry.content ?: diskValue
            view.sendInitialValue(value)
            entry.ready += view
            if (entry.content == null) entry.content = value
            if (entry.lastWritten == null) entry.lastWritten = value
            wake(entry)
        }
    }

    /** The page reloads or shows its timeout page: it holds nothing until it asks again. */
    fun onViewUnready(file: DocumentFile, view: HubView) {
        val entry = entries[file] ?: return
        if (view !in entry.views) return
        readying.remove(view)
        entry.ready.remove(view)
        JoinWindow.dropRecipient(entry.quiet, view)
    }

    /** A replica saved, so the content is current for what its view had seen; a null value changed nothing. */
    fun onValueSaved(file: DocumentFile, view: HubView, value: String?) {
        val entry = entries[file] ?: return
        if (view !in entry.views) return
        if (value != null) entry.content = value
        JoinWindow.noteSave(entry.quiet, view, clock.nowMs())
    }

    /** A view's shared store emitted: every other ready view of the file gets it, then every joined peer. */
    fun onViewActions(file: DocumentFile, view: HubView, actions: JsonNode) {
        val entry = entries[file] ?: return
        if (actions !is ArrayNode || view !in entry.views) return
        observe(entry, actions, ActionSource.WEBVIEW)
        injectToViews(entry, actions, except = view)
        deliver(entry, actions, ActionSource.WEBVIEW, except = null)
    }

    /** An editor wrote value to the file. */
    fun onWritten(file: DocumentFile, value: String) {
        entries[file]?.lastWritten = value
    }

    /** A view closes; the last to close takes the document with it and tells its peers. */
    fun removeView(file: DocumentFile, view: HubView) {
        val entry = entries[file] ?: return
        if (!entry.views.remove(view)) return
        readying.remove(view)
        entry.ready.remove(view)
        JoinWindow.dropRecipient(entry.quiet, view)
        if (entry.views.isEmpty()) unregister(entry)
    }

    /**
     * A local file or folder was renamed or moved: every document whose local path changed tells its
     * peers under the old path, then is served under the new one, or let go when no longer an ERD file.
     */
    fun pathsMayHaveChanged() {
        for (entry in entries.values.toList()) {
            val localPath = entry.file.localPath
            if (localPath == entry.localPath) continue
            closeForPeers(entry)
            if (DocumentRules.erdFileProblem(localPath) != null) {
                unregister(entry)
                continue
            }
            entry.path = localPath
            entry.localPath = localPath
            entry.resolved = false
            entry.generation++
            publish()
            resolve(entry)
        }
    }

    /** The file became writable or read-only: every page learns it, peers rejoin, open waiters wake. */
    fun writabilityChanged(file: DocumentFile) {
        val entry = entries[file] ?: return
        val readonly = !file.isWritable
        for (view in entry.views) view.pushReadonly(readonly)
        closeForPeers(entry)
        wake(entry)
    }

    /** The file of the ERD editor that took focus last; a focus elsewhere leaves it in place. */
    fun setActive(file: DocumentFile) {
        entries[file]?.let { active = it }
    }

    /** Waits, capMs at most, until the lock lists the file, so an agent can reach it before the page takes edits. */
    suspend fun awaitListed(file: DocumentFile, capMs: Long) {
        val entry = entries[file] ?: return
        withTimeoutOrNull(capMs) { entry.listed.await() }
    }

    /** Every document, the writable ones first. */
    fun documents(): List<DocumentEntry> {
        val (readonly, writable) = entries.values.partition { isReadonly(it) }
        return writable + readonly
    }

    /** The document at a real path, a writable one ahead of a read-only file at the same path. */
    fun find(path: String): DocumentEntry? {
        var readonlyMatch: DocumentEntry? = null
        for (entry in entries.values) {
            if (!HubPaths.isSamePath(entry.path, path, platform)) continue
            if (!isReadonly(entry)) return entry
            if (readonlyMatch == null) readonlyMatch = entry
        }
        return readonlyMatch
    }

    fun findWritable(path: String): DocumentEntry? = find(path)?.takeIf { !isReadonly(it) }

    fun isActive(entry: DocumentEntry): Boolean = active === entry

    /** The content differs from what the file last took, or a replica still owes a save. */
    fun isDirty(entry: DocumentEntry): Boolean {
        val written = entry.lastWritten
        val content = entry.content
        return entry.quiet.pending || (written != null && content != null && written != content)
    }

    /** Read now: the IDE can change it at any time. */
    fun isReadonly(entry: DocumentEntry): Boolean = !entry.file.isWritable

    /** Only ready views of a resolved document count; with none, agent edits are refused. */
    fun readyCount(entry: DocumentEntry): Int = if (entry.resolved) entry.ready.size else 0

    /** The view save writes through: the first opened. */
    fun writer(entry: DocumentEntry): HubView? = entry.views.firstOrNull()

    /** Resolves Ready once a view of path is ready or the document is read-only, TimedOut after timeoutMs. */
    fun waitForReady(path: String, timeoutMs: Long): ReadyWait {
        var timer: ScheduledFuture<*>? = null
        val wait = ReadyWait(path) {
            readyWaiters.remove(it)
            timer?.cancel(false)
        }
        readyWaiters += wait
        // Null once the hub's threads stopped: nothing would ever fire it.
        timer = threads.schedule(timeoutMs) { wait.resolve(ReadyOutcome.TimedOut) }
        return wait
    }

    /** The open waits not resolved yet, each with its timer; none is left once its request answered. */
    internal val pendingReadyWaits: Int get() = readyWaiters.size

    /** True once no replica save is outstanding, false if one still is at capMs. */
    suspend fun whenQuiet(entry: DocumentEntry, capMs: Long): Boolean = JoinWindow.waitForQuiet(entry.quiet, capMs)

    /**
     * Seeds a peer. It queues deliveries from the start, waits for the document to go quiet, then
     * captures content and observedVersion in one step; the queue empties in afterResponse, once the
     * answer is queued. A document no view ever readied is read from disk, never answered empty, and
     * so is one the last revoked scope no longer admits, closed for the peer once answered.
     */
    suspend fun join(entry: DocumentEntry, connection: HubConnection): JoinOutcome {
        if (isShutDown || entries[entry.file] !== entry || connection in gone) {
            throw DocumentRules.closedDuringJoin(entry.path)
        }
        val path = entry.path
        if (!admits(path)) return joinUntracked(connection, path)
        // Tracked now, so a shutdown or a revoke during the wait tells the peer; what closed for the
        // connection before is forgotten only once the join succeeds, as a failed one leaves what it found.
        val added = addTracked(connection, path)
        val queue = ArrayList<QueuedBatch>()
        val peer = JoinPeer(connection).also { it.queue = queue }
        entry.peers[connection] = peer
        try {
            val deadline = clock.nowMs() + timings.joinQuietCapMs
            JoinWindow.waitUntilQuiet(entry.quiet, timings.joinQuietCapMs, clock)
            checkJoined(entry, peer)
            val text = joinText(entry, peer, deadline)
            val snapshotVersion = entry.observedVersion
            val result = HubResults.join(DocumentRules.stripBom(text), snapshotVersion, isReadonly(entry))
            val captured = queue.size
            recentlyClosed.remove(connection)
            return JoinOutcome(result) { endJoinWindow(entry, peer, queue, captured, snapshotVersion) }
        } catch (e: Throwable) {
            if (entry.peers[connection] === peer) {
                entry.peers.remove(connection)
                if (added) untrack(connection, path, remembering = false)
            }
            throw e
        }
    }

    fun isJoined(entry: DocumentEntry, connection: HubConnection): Boolean = entry.peers.containsKey(connection)

    /**
     * A joined peer's batch, for every other peer and every ready view. A view never relays it back,
     * since it arrives tagged shared, so the other peers hear of it only from here. Returns the views given it.
     */
    fun applyPeerActions(entry: DocumentEntry, from: HubConnection, actions: ArrayNode): Int {
        if (entries[entry.file] !== entry) return 0
        observe(entry, actions, ActionSource.PEER)
        deliver(entry, actions, ActionSource.PEER, except = from)
        return injectToViews(entry, actions, except = null)
    }

    /** Drops the peer from every document at path; the path stays tracked, as only documentClosed lets it go. */
    fun leave(path: String, connection: HubConnection) {
        for (entry in entries.values) {
            if (HubPaths.isSamePath(entry.path, path, platform)) entry.peers.remove(connection)
        }
    }

    fun disconnect(connection: HubConnection) {
        gone += connection
        for (entry in entries.values) entry.peers.remove(connection)
        tracked.remove(connection)
        recentlyClosed.remove(connection)
    }

    /** Tracks path for the connection; false, tracking nothing, when the last revoked scope no longer admits it. */
    fun track(connection: HubConnection, path: String): Boolean {
        // Nothing is left to tell a connection that hung up, and nothing to track for it.
        if (connection in gone) return true
        if (!admits(path)) return false
        addTracked(connection, path)
        recentlyClosed.remove(connection)
        return true
    }

    /** A path track refused: the peer hears documentClosed, and a connection left with nothing it may reach ends. */
    fun closeUntracked(connection: HubConnection, path: String) {
        if (connection in gone) return
        connection.notify(HubNotification.DocumentClosed(path))
        val closed = remember(connection, path)
        lastScope?.let { endIfIdle(connection, closed, it) }
    }

    /**
     * The lock's folders or documents changed. Every tracked path the new scope no longer admits is
     * closed for its peer; a connection left tracking nothing, with only unauthorized paths closed
     * since it last tracked one, ends gracefully, so the agent falls back to the file.
     */
    fun revoke(scope: AuthScope) {
        lastScope = scope
        for ((connection, paths) in tracked.entries.toList()) {
            for (path in paths.toList()) {
                if (authorized(scope, path)) continue
                for (entry in entries.values) {
                    if (HubPaths.isSamePath(entry.path, path, platform)) entry.peers.remove(connection)
                }
                connection.notify(HubNotification.DocumentClosed(path))
                untrack(connection, path, remembering = true)
            }
        }
        for ((connection, closed) in recentlyClosed.entries.toList()) endIfIdle(connection, closed, scope)
    }

    /**
     * The plugin is going away: every peer hears documentClosed for every path it joined or read,
     * no peer registers after this and open waits end. Returns the peers told, whose frames the caller drains.
     */
    fun shutdown(): List<HubConnection> {
        isShutDown = true
        publisher = null
        for (entry in entries.values) entry.peers.clear()
        val told = tracked.keys.toList()
        for ((connection, paths) in tracked) {
            for (path in paths) connection.notify(HubNotification.DocumentClosed(path))
        }
        tracked.clear()
        recentlyClosed.clear()
        for (wait in readyWaiters.toList()) wait.resolve(ReadyOutcome.Cancelled)
        return told
    }

    /**
     * A join of a path the last revoked scope no longer admits: answered from the file, as a join of
     * a document no editor holds, and closed for the peer only once that answer is on its way.
     */
    private suspend fun joinUntracked(connection: HubConnection, path: String): JoinOutcome {
        val text = withContext(threads.io) { readFile(path) }
        val result = HubResults.join(DocumentRules.stripBom(text), 0.0, false)
        return JoinOutcome(result) { closeUntracked(connection, path) }
    }

    private fun checkJoined(entry: DocumentEntry, peer: JoinPeer) {
        if (entries[entry.file] !== entry || entry.peers[peer.connection] !== peer) {
            throw DocumentRules.closedDuringJoin(entry.path)
        }
    }

    /**
     * The mirror, or the file while no view was ever ready. A view that turns ready during the read
     * emitted into the mirror only, so the disk text is dropped and the join waits out the rest of its cap.
     */
    private suspend fun joinText(entry: DocumentEntry, peer: JoinPeer, deadline: Double): String {
        entry.content?.let { return it }
        val disk = withContext(threads.io) { readFile(entry.path) }
        checkJoined(entry, peer)
        if (entry.content == null) return disk
        val left = deadline - clock.nowMs()
        if (left > 0) JoinWindow.waitUntilQuiet(entry.quiet, ceil(left).toLong(), clock)
        checkJoined(entry, peer)
        return entry.content ?: disk
    }

    /** The file as it is on disk, a missing one refused with notFound. On io. */
    private fun readFile(path: String): String = try {
        fs.readText(path)
    } catch (e: NoSuchFileException) {
        throw DocumentRules.fileMissing(path)
    }

    /** Ends the peer's join window, unless it left, joined again or the document closed since. */
    private fun endJoinWindow(
        entry: DocumentEntry,
        peer: JoinPeer,
        queue: List<QueuedBatch>,
        captured: Int,
        snapshotVersion: Double,
    ) {
        if (entry.peers[peer.connection] !== peer) return
        peer.queue = null
        for (batch in JoinWindow.drainJoinQueue(queue, captured, snapshotVersion, entry.path, log)) {
            peer.connection.notify(HubNotification.Actions(entry.path, batch.actions))
        }
    }

    private fun observe(entry: DocumentEntry, actions: ArrayNode, source: ActionSource) {
        entry.observedVersion = JoinWindow.maxVersion(entry.observedVersion, actions)
        // Every ready view replicates the change and owes its save, resolved or not.
        if (JoinWindow.hasChangeAction(actions)) {
            JoinWindow.noteChange(entry.quiet, source, clock.nowMs(), entry.ready, timings.replicaDebounceMs)
        }
    }

    /** The one way into views: ready ones only, whatever resolved says, the sender left out. */
    private fun injectToViews(entry: DocumentEntry, actions: ArrayNode, except: HubView?): Int {
        var count = 0
        for (view in entry.ready) {
            if (view === except) continue
            view.inject(actions)
            count++
        }
        return count
    }

    /**
     * The one way to a peer: inside its join window a delivery waits in the queue, after it one
     * notification, encoded once, goes to every peer but except.
     */
    private fun deliver(entry: DocumentEntry, actions: ArrayNode, source: ActionSource, except: HubConnection?) {
        val notification = HubNotification.Actions(entry.path, actions)
        for (peer in entry.peers.values) {
            if (peer.connection === except) continue
            val queue = peer.queue
            if (queue != null) queue += QueuedBatch(source, actions) else peer.connection.notify(notification)
        }
    }

    /** Tells the joined peers the document they hold is gone, even inside a join window. */
    private fun closeForPeers(entry: DocumentEntry) {
        val notification = HubNotification.DocumentClosed(entry.path)
        for (connection in entry.peers.keys) {
            connection.notify(notification)
            untrack(connection, entry.path, remembering = true)
        }
        entry.peers.clear()
    }

    private fun untrack(connection: HubConnection, path: String, remembering: Boolean) {
        val paths = tracked[connection]
        if (paths != null) {
            paths.removeAll { HubPaths.isSamePath(it, path, platform) }
            if (paths.isEmpty()) tracked.remove(connection)
        }
        if (remembering) remember(connection, path)
    }

    /** Whether the last revoked scope admits path; every path does before the first revoke. */
    private fun admits(path: String): Boolean = lastScope?.let { authorized(it, path) } ?: true

    /** Adds path to what the connection tracks; true when it was not tracked already. */
    private fun addTracked(connection: HubConnection, path: String): Boolean {
        val paths = tracked.getOrPut(connection) { ArrayList() }
        if (paths.any { HubPaths.isSamePath(it, path, platform) }) return false
        paths += path
        return true
    }

    /** Adds path to what closed for the connection since it last tracked one; returns all of it. */
    private fun remember(connection: HubConnection, path: String): List<String> =
        recentlyClosed.getOrPut(connection) { ArrayList() }.also { it += path }

    /** Ends a connection that tracks nothing and whose closed paths scope no longer admits, once. */
    private fun endIfIdle(connection: HubConnection, closed: List<String>, scope: AuthScope) {
        if (tracked.containsKey(connection) || closed.any { authorized(scope, it) }) return
        recentlyClosed.remove(connection)
        connection.end()
    }

    private fun authorized(scope: AuthScope, path: String): Boolean =
        HubPaths.isAuthorized(scope.folders, scope.documents, path, platform)

    private fun unregister(entry: DocumentEntry) {
        entries.remove(entry.file)
        if (active === entry) active = null
        // A view still waiting for its value is seeded by nothing now, and the entry wakes no open wait.
        for (view in entry.views) readying.remove(view)
        entry.resolved = false
        closeForPeers(entry)
        publish()
    }

    /** Keys the document by its path on disk; a step whose document closed or was renamed since lands nowhere. */
    private fun resolve(entry: DocumentEntry) {
        val generation = entry.generation
        val path = entry.path
        val authz = authz
        if (authz == null) {
            land(entry, generation, path)
            return
        }
        threads.scope.launch(threads.registry) {
            val real = withContext(threads.io) { authz.realpathOrSelf(path) }
            land(entry, generation, real)
        }
    }

    private fun land(entry: DocumentEntry, generation: Int, real: String) {
        if (entries[entry.file] !== entry || entry.generation != generation) return
        entry.path = real
        entry.resolved = true
        wake(entry)
        publish()
    }

    /** Resolves every open waiter of the document's path once a view of it is ready or it can only be read. */
    private fun wake(entry: DocumentEntry) {
        if (!entry.resolved) return
        if (readyCount(entry) == 0 && !isReadonly(entry)) return
        for (wait in readyWaiters.toList()) {
            if (HubPaths.isSamePath(wait.path, entry.path, platform)) wait.resolve(ReadyOutcome.Ready(entry))
        }
    }

    /** Lists every resolved document by its real path, each once; those listed learn it once the lock holds them. */
    private fun publish() {
        val listed = entries.values.filter { it.resolved }
        val publisher = publisher
        if (publisher == null) {
            for (entry in listed) entry.listed.complete(Unit)
            return
        }
        publisher.publish(listed.map { it.path }.distinct()).whenComplete { _, error ->
            if (error != null) log.warn("could not list the open documents in the lock", error)
            for (entry in listed) entry.listed.complete(Unit)
        }
    }
}
