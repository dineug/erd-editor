package com.github.dineug.erdeditorintellijplugin.agents

import com.github.dineug.erdeditorintellijplugin.hub.HubClock
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.server.HubHost
import com.github.dineug.erdeditorintellijplugin.settings.AgentHubSettings
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.readAction
import com.intellij.openapi.progress.ProcessCanceledException
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.roots.ProjectRootManager
import java.nio.file.InvalidPathException
import java.nio.file.Path
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Future

/**
 * The IDE as the hub's host: one hub for every project of the process, so the lock lists the folders
 * of every open project, trusted or not, and the Coding agents setting turns it on and off. Nothing is
 * kept about the projects: each read asks the IDE again, through a read action that a write cancels.
 */
class IntelliJHubHost(
    parent: Disposable,
    private val threads: HubThreads,
    private val timings: HubTimings,
) : HubHost {
    override val ide: String = "intellij"

    private val enabledListeners = CopyOnWriteArrayList<() -> Unit>()
    private val foldersListeners = CopyOnWriteArrayList<() -> Unit>()
    private val foldersBurst =
        Coalescer(timings.foldersDebounceMs, FOLDERS_BURST_CAP_MS, threads::schedule) { fire(foldersListeners) }

    init {
        ApplicationManager.getApplication().messageBus.connect(parent)
            .subscribe(AgentHubSettings.Listener.TOPIC, object : AgentHubSettings.Listener {
                override fun codingAgentsChanged(enabled: Boolean) = fire(enabledListeners)
            })
    }

    // Read each time: loading the settings publishes nothing, so the topic only says to look again.
    override fun isEnabled(): Boolean = AgentHubSettings.instance.codingAgents

    /** The open projects' local content roots and base paths, in project order, each once. */
    override suspend fun folders(): List<String> = unionFolders(openProjectRoots()) { it.second }

    override fun onEnabledChange(listener: () -> Unit): AutoCloseable = subscribe(enabledListeners, listener)

    override fun onFoldersChange(listener: () -> Unit): AutoCloseable = subscribe(foldersListeners, listener)

    /** A project opened or closed, or its roots changed: the listeners hear it once a burst pauses. */
    fun foldersChanged() = foldersBurst.request()

    /**
     * Every open, non-disposed, non-default project with its local content roots, then its base path.
     * The cancellable read action suspends while a write waits, never blocking the thread on the lock.
     */
    suspend fun openProjectRoots(): List<Pair<Project, List<String>>> = readAction {
        ProjectManager.getInstance().openProjects.mapNotNull { project ->
            project.whileOpen { localRoots(project) }?.let { project to it }
        }
    }

    private fun localRoots(project: Project): List<String> {
        val roots = ProjectRootManager.getInstance(project).contentRoots
            .filter { it.isInLocalFileSystem }
            .map { it.toNioPath().toString() }
        return roots + listOfNotNull(project.basePath?.let(::nativePath))
    }

    private fun subscribe(listeners: MutableList<() -> Unit>, listener: () -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners.remove(listener) }
    }

    private fun fire(listeners: List<() -> Unit>) {
        for (listener in listeners) listener()
    }

    private companion object {
        /** A storm of root changes that never pauses, a long Gradle sync, still reaches the lock each second. */
        const val FOLDERS_BURST_CAP_MS = 1_000L
    }
}

/**
 * Every project's folders in project order, each once. The caller leaves out the projects that are
 * closing, disposed or the default one.
 */
internal fun <P> unionFolders(projects: List<P>, roots: (P) -> List<String>): List<String> {
    val folders = LinkedHashSet<String>()
    for (project in projects) folders += roots(project)
    return folders.toList()
}

/**
 * Runs fire once a burst of requests pauses for delayMs, or capMs after its first request when it
 * never pauses. Each request is followed by a fire that starts after it, and the hub reads the folders
 * only then, so none is missed. schedule is HubThreads.schedule: null once the hub's threads stopped.
 */
internal class Coalescer(
    private val delayMs: Long,
    private val capMs: Long,
    private val schedule: (Long, () -> Unit) -> Future<*>?,
    private val clock: HubClock = HubClock.monotonic,
    private val fire: () -> Unit,
) {
    private val lock = Any()

    /** The burst's scheduled fire; only the one holding the current token fires. */
    private var pending: Future<*>? = null
    private var token: Any? = null
    private var burstStartMs = 0.0

    fun request() {
        synchronized(lock) {
            val now = clock.nowMs()
            if (token == null) burstStartMs = now
            val leftMs = burstStartMs + capMs - now
            // At the cap the pending fire is due already, and it reads the folders after this request.
            if (token != null && leftMs <= 0) return
            pending?.cancel(false)
            val mine = Any()
            token = mine
            pending = schedule(minOf(delayMs.toDouble(), leftMs).toLong()) { fireIfCurrent(mine) }
            // The hub's threads stopped: nothing is left to tell, and a later request starts afresh.
            if (pending == null) token = null
        }
    }

    private fun fireIfCurrent(mine: Any) {
        synchronized(lock) {
            // A request replaced this fire after it had started: the later one fires instead.
            if (token !== mine) return
            token = null
            pending = null
        }
        fire()
    }
}

/**
 * The block's value, or null for a project that is closing or the default one. A project disposed
 * during the read throws ProcessCanceledException from its services; any other cancellation goes on.
 */
internal inline fun <T> Project.whileOpen(block: () -> T): T? {
    if (isDisposed || isDefault) return null
    return try {
        block()
    } catch (e: ProcessCanceledException) {
        if (isDisposed) null else throw e
    }
}

/** A system-independent path, such as Project.getBasePath() gives, with the separators of this OS. */
private fun nativePath(path: String): String? = try {
    Path.of(path).toString()
} catch (e: InvalidPathException) {
    null
}
