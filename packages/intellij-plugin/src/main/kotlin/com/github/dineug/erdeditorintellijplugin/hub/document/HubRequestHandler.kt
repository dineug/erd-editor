package com.github.dineug.erdeditorintellijplugin.hub.document

import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.AuthScope
import com.github.dineug.erdeditorintellijplugin.hub.Authz
import com.github.dineug.erdeditorintellijplugin.hub.HubEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.github.dineug.erdeditorintellijplugin.hub.HubPaths
import com.github.dineug.erdeditorintellijplugin.hub.HubRequestError
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.rethrowIfCancellation
import com.github.dineug.erdeditorintellijplugin.hub.server.ApplyParams
import com.github.dineug.erdeditorintellijplugin.hub.server.HandlerResult
import com.github.dineug.erdeditorintellijplugin.hub.server.HubConnection
import com.github.dineug.erdeditorintellijplugin.hub.server.HubHandler
import com.github.dineug.erdeditorintellijplugin.hub.server.HubNotification
import com.github.dineug.erdeditorintellijplugin.hub.server.HubResults
import com.github.dineug.erdeditorintellijplugin.hub.server.OpenParams
import com.github.dineug.erdeditorintellijplugin.hub.server.PathParams
import kotlinx.coroutines.async
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.nio.file.FileAlreadyExistsException
import java.nio.file.NoSuchFileException
import java.util.concurrent.CancellationException

/**
 * Serves the hub's requests from the registry, as Obsidian's handlers.ts with the IDE's rules: a
 * path in params is already authorized and real, and must name an ERD file; a path only projects the
 * user never trusted hold is read but never changed, trust read once per request. Only openDocument
 * opens an editor, and only openDocument with create writes a file. Runs on the registry thread.
 */
class HubRequestHandler(
    private val registry: DocumentRegistry,
    private val ide: IdeFacade,
    private val env: HubEnvironment,
    private val authz: Authz,
    private val scope: () -> AuthScope,
    private val threads: HubThreads,
    private val log: HubLog,
    private val timings: HubTimings = HubTimings(),
) : HubHandler {
    /** Open documents first, writable ahead of read-only, then every ERD file of the projects, once by real path. */
    override suspend fun listDocuments(params: ObjectNode, connection: HubConnection): HandlerResult {
        val trust = trustSnapshot(scope().folders)
        val documents = ArrayList<ObjectNode>()
        val paths = ArrayList<String>()
        fun add(path: String, open: Boolean, active: Boolean, dirty: Boolean, readonly: Boolean) {
            if (paths.any { HubPaths.isSamePath(it, path, env.platform) }) return
            paths += path
            documents += HubResults.documentInfo(path, open, active, dirty, readonly)
        }
        for (entry in registry.documents()) {
            val readonly = registry.isReadonly(entry) || trust.untrustedOnly(entry.path)
            add(entry.path, true, registry.isActive(entry), registry.isDirty(entry), readonly)
        }
        val files = withContext(threads.io) { ide.listErdFiles().map(authz::realpathOrSelf) }
        for (real in files) add(real, open = false, active = false, dirty = false, readonly = trust.untrustedOnly(real))
        return HandlerResult(HubResults.listDocuments(documents))
    }

    /**
     * Shows the file in an ERD editor without focus and answers once one is ready, within the ready
     * timeout whatever the EDT does: the open runs on its own, and its failure ends the wait at once.
     */
    override suspend fun openDocument(params: OpenParams, connection: HubConnection): HandlerResult {
        val path = params.path
        DocumentRules.assertErdFile(path)
        refuseAfterShutdown(path)
        refuseUntrusted(path)
        // Again after the trust read: an editor still closing after shutdown looks ready.
        refuseAfterShutdown(path)
        val current = registry.findWritable(path)
        if (current != null && registry.readyCount(current) > 0) {
            return result(HubResults.openDocument(path, false, registry.readyCount(current)))
        }
        val shown = registry.find(path)
        if (shown != null && registry.isReadonly(shown)) throw DocumentRules.readonlyFile(path)

        val wait = registry.waitForReady(path, timings.openReadyTimeoutMs)
        try {
            withContext(threads.io) { ensureFile(params) }
        } catch (e: Throwable) {
            wait.cancel()
            throw e
        }
        threads.scope.launch(threads.registry) {
            // A shutdown during the file step, or before this runs, ended the wait: a closing IDE opens nothing.
            if (registry.isShutDown) return@launch
            try {
                ide.openInEditor(path, shown?.file)
            } catch (e: Throwable) {
                e.rethrowIfCancellation()
                wait.failOpen(e)
            }
        }
        return when (val outcome = wait.await()) {
            is ReadyOutcome.Ready -> {
                if (registry.isReadonly(outcome.entry)) throw DocumentRules.readonlyFile(path)
                result(HubResults.openDocument(path, true, registry.readyCount(outcome.entry)))
            }
            ReadyOutcome.TimedOut -> throw DocumentRules.openTimedOut(path)
            ReadyOutcome.Cancelled -> throw turningOff(path)
            is ReadyOutcome.OpenFailed -> {
                throw DocumentRules.editorCouldNotOpen(ide.editorName, path, reasonOf(outcome.error))
            }
        }
    }

    /**
     * Joins a document an editor holds; any other file, or one of a project the user never trusted,
     * is answered from disk without joining, and tracked so a shutdown or a revoke tells the peer.
     */
    override suspend fun join(params: PathParams, connection: HubConnection): HandlerResult {
        val path = params.path
        DocumentRules.assertErdFile(path)
        if (!untrusted(path)) {
            val entry = registry.find(path)
            if (entry != null && !registry.isShutDown) {
                val outcome = registry.join(entry, connection)
                return HandlerResult(outcome.result, outcome.afterResponse)
            }
        }
        val text = withContext(threads.io) { readDisk(path) }
        val result = HubResults.join(DocumentRules.stripBom(text), 0.0, false)
        // After the answer: a peer told first would take the answer for a registration and wait on the editor.
        if (registry.isShutDown) {
            return HandlerResult(result) { connection.notify(HubNotification.DocumentClosed(path)) }
        }
        if (registry.track(connection, path)) return HandlerResult(result)
        return HandlerResult(result) { registry.closeUntracked(connection, path) }
    }

    /** Suspends only for the trust read; the connection's next frame waits for this answer. */
    override suspend fun applyActions(params: ApplyParams, connection: HubConnection): HandlerResult {
        val path = params.path
        DocumentRules.assertErdFile(path)
        refuseUntrusted(path)
        val entry = registry.find(path)
        if (entry != null && registry.isReadonly(entry)) throw DocumentRules.readonlyFile(path)
        if (entry == null || registry.readyCount(entry) == 0) throw DocumentRules.notReadyForActions(path)
        if (!registry.isJoined(entry, connection)) throw DocumentRules.notJoined(path)
        return result(HubResults.applyActions(registry.applyPeerActions(entry, connection, params.actions)))
    }

    override suspend fun leave(params: PathParams, connection: HubConnection): HandlerResult {
        registry.leave(params.path, connection)
        return result(HubResults.leave())
    }

    /**
     * Waits for the replicas to hold every edit, then writes the mirror through the first editor now,
     * rather than after its autosave debounce; saved is whether the file then holds it.
     */
    override suspend fun save(params: PathParams, connection: HubConnection): HandlerResult {
        val path = params.path
        DocumentRules.assertErdFile(path)
        refuseUntrusted(path)
        val entry = registry.find(path) ?: throw DocumentRules.notOpenInEditor(path)
        if (registry.isReadonly(entry)) throw DocumentRules.readonlyFileSave(path)

        val settled = registry.whenQuiet(entry, timings.saveQuietCapMs)
        if (registry.findWritable(path) !== entry) throw DocumentRules.closedBeforeSave(path)
        if (!settled) {
            log.warn(DocumentRules.unsettledSave(path))
            return saved(false)
        }
        // Nothing loaded yet is nothing to save.
        val captured = entry.content ?: return saved(true)
        val file = entry.file
        if (!file.isValid || !file.isWritable) return saved(false)
        val writer = registry.writer(entry) ?: return saved(false)
        // The mirror as it stands inside the write action, so no older bytes land over an autosave made meanwhile.
        return saved(writeThrough(path, writer) { entry.content ?: captured })
    }

    override fun disconnect(connection: HubConnection) {
        registry.disconnect(connection)
    }

    /**
     * The writer's write, bounded: a modal dialog can hold the EDT past the agent's own timeout, so
     * the write runs on its own and the answer is false once the bound passes.
     */
    private suspend fun writeThrough(path: String, writer: HubView, latest: () -> String): Boolean {
        val write = threads.scope.async(threads.registry) { writer.writeNow(latest) }
        val written = try {
            withTimeoutOrNull(timings.saveWriteBoundMs) { write.await() }
        } catch (e: Throwable) {
            // Only this request's own cancellation goes on; a write that failed or was cancelled answers false.
            currentCoroutineContext().ensureActive()
            // A cancellation is never logged, only the save it cost.
            log.warn(DocumentRules.saveFailed(path), e.takeUnless { it is CancellationException })
            return false
        }
        if (written == null) {
            write.cancel()
            log.warn(DocumentRules.saveWriteTimedOut(path))
            return false
        }
        if (!written) log.warn(DocumentRules.stillUnsaved(path))
        return written
    }

    /** openDocument's file: there already, or created exclusively from initialValue. On io. */
    private fun ensureFile(params: OpenParams) {
        val path = params.path
        if (!params.create) {
            try {
                env.fs.statExisting(path)
            } catch (e: NoSuchFileException) {
                throw DocumentRules.fileMissing(path)
            }
            return
        }
        val initialValue = params.initialValue ?: throw DocumentRules.createNeedsInitialValue()
        try {
            env.fs.createExclusive(path, initialValue)
        } catch (e: FileAlreadyExistsException) {
            // An existing file is left as it is.
        } catch (e: NoSuchFileException) {
            throw DocumentRules.folderMissing(path)
        }
    }

    /** The file as it is on disk; the file system drops one byte order mark, the caller a second. On io. */
    private fun readDisk(path: String): String = try {
        env.fs.readText(path)
    } catch (e: NoSuchFileException) {
        throw DocumentRules.fileMissing(path)
    }

    private fun refuseAfterShutdown(path: String) {
        if (registry.isShutDown) throw turningOff(path)
    }

    private suspend fun refuseUntrusted(path: String) {
        if (untrusted(path)) throw DocumentRules.untrustedProject(path)
    }

    /**
     * Whether only projects the user never trusted hold path, read now. A path outside every folder
     * of the lock is a document-only file of no project, so it reads no project at all.
     */
    private suspend fun untrusted(path: String): Boolean {
        val folders = scope().folders
        if (folders.none { HubPaths.isInside(it, path, env.platform) }) return false
        return trustSnapshot(folders).untrustedOnly(path)
    }

    private suspend fun trustSnapshot(folders: List<String>): TrustSnapshot =
        TrustSnapshot(withContext(threads.io) { ide.trustedProjects() }, folders, env.platform)

    private fun turningOff(path: String): HubRequestError =
        DocumentRules.editorCouldNotOpen(ide.editorName, path, DocumentRules.REASON_TURNING_OFF)

    /** An OpenRefused names its reason; any other failure reads as the server prints one. */
    private fun reasonOf(error: Throwable): String =
        if (error is OpenRefused) "${error.message}" else "${error.javaClass.simpleName}: ${error.message}"

    private fun result(result: ObjectNode) = HandlerResult(result)

    private fun saved(saved: Boolean) = HandlerResult(HubResults.save(saved))
}
