package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.document.IdeFacade
import com.github.dineug.erdeditorintellijplugin.hub.document.ProjectTrust
import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger

/**
 * The IDE as the handlers see it: what opening a file does, the ERD files of the projects and the
 * projects' trust, each set by the test; every call is counted. The editor is named "IntelliJ IDEA".
 */
class FakeIdeFacade(override val editorName: String = "IntelliJ IDEA") : IdeFacade {
    /** What openInEditor does with a path. */
    sealed interface OpenBehaviour {
        /** Runs block on the registry thread, as the IDE's open would make an editor and its page. */
        class Run(val block: suspend (path: String, known: DocumentFile?) -> Unit) : OpenBehaviour

        /** Returns, and no editor ever reports ready. */
        data object NeverReady : OpenBehaviour

        /** Never returns until gate completes, as an open stuck behind a modal dialog. */
        class Hang(val gate: CompletableDeferred<Unit> = CompletableDeferred()) : OpenBehaviour

        /** Throws error, an OpenRefused or any other. */
        class Throw(val error: Throwable) : OpenBehaviour
    }

    @Volatile
    var openBehaviour: OpenBehaviour = OpenBehaviour.NeverReady

    private val opens = CopyOnWriteArrayList<Pair<String, DocumentFile?>>()

    /** Every openInEditor call: the path and the registered file handed over with it. */
    val openCalls: List<Pair<String, DocumentFile?>> get() = opens.toList()

    @Volatile
    var erdFiles: List<String> = emptyList()
    val listCalls = AtomicInteger()

    @Volatile
    var projects: List<ProjectTrust> = emptyList()
    val trustReads = AtomicInteger()

    /** When set, trustedProjects waits for it, so a test can act while a request reads trust. */
    @Volatile
    var trustGate: CompletableDeferred<Unit>? = null

    /** When set, trustedProjects throws it. */
    @Volatile
    var trustError: Throwable? = null

    override suspend fun openInEditor(path: String, known: DocumentFile?) {
        opens += path to known
        when (val behaviour = openBehaviour) {
            is OpenBehaviour.Run -> behaviour.block(path, known)
            OpenBehaviour.NeverReady -> {}
            is OpenBehaviour.Hang -> behaviour.gate.await()
            is OpenBehaviour.Throw -> throw behaviour.error
        }
    }

    override suspend fun listErdFiles(): List<String> {
        listCalls.incrementAndGet()
        return erdFiles
    }

    override suspend fun trustedProjects(): List<ProjectTrust> {
        trustReads.incrementAndGet()
        trustGate?.await()
        trustError?.let { throw it }
        return projects
    }
}
