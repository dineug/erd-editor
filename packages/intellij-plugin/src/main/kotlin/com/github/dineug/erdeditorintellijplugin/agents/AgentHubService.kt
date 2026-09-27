package com.github.dineug.erdeditorintellijplugin.agents

import com.github.dineug.erdeditorintellijplugin.hub.Authz
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.HubRuntime
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.MachineEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentRules
import com.intellij.ide.plugins.cl.PluginAwareClassLoader
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.ControlFlowException
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.jcef.JBCefApp
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.CancellationException

/**
 * The coding-agent hub of this IDE process: one lock, one pipe, every open project. The document
 * registry runs from the first ERD editor or project on, whether or not the hub does; the hub itself
 * runs only where an ERD editor can and a pid names this process to the MCP server.
 */
@Service(Service.Level.APP)
class AgentHubService : Disposable {
    private val log = IdeHubLog()
    private val timings = HubTimings()
    private val platform = HubPlatform.current()

    /** Why the IDE itself keeps the hub off, read before anything subscribes to the IDE. */
    private val environmentReason: String? = environmentReason(platform)

    private val threads = HubThreads(log)
    val host: IntelliJHubHost = IntelliJHubHost(this, threads, timings)
    val runtime: HubRuntime

    /** Why this IDE runs no hub, as the settings page shows it; null when the hub runs. */
    val unavailableReason: String?

    // The hub's steps never throw out of the constructor: a failed service would open no ERD file,
    // and the platform would never dispose the bus connection the host has made by now.
    init {
        var failure: String? = null
        val served = if (environmentReason == null) {
            try {
                hubRuntime(MachineEnvironment.forMachine(pluginVersion(), log = log))
            } catch (e: Exception) {
                failure = hubFailed(e)
                null
            } catch (e: LinkageError) {
                failure = hubFailed(e)
                null
            }
        } else {
            null
        }
        runtime = served ?: hubRuntime(null)
        environmentReason?.let { log.info("the document hub does not start: $it") }
        try {
            runtime.start()
        } catch (e: Exception) {
            failure = hubFailed(e)
        }
        unavailableReason = environmentReason ?: failure
    }

    /** The registry and, with env, the hub serving it; without env the registry alone. */
    private fun hubRuntime(env: MachineEnvironment?): HubRuntime {
        val ide = IntelliJIdeFacade(host, env?.let(::Authz), threads, platform)
        return HubRuntime(env, host, ide, log = log, platform = platform, timings = timings, threads = threads)
    }

    /** Logs why the hub could not start; the registry alone still serves the editors. */
    private fun hubFailed(e: Throwable): String {
        if (e is ControlFlowException || e is CancellationException) throw e
        log.warn(HUB_FAILED, e)
        return "$HUB_FAILED (idea.log has the error)"
    }

    /** A project opened, so the lock lists its folders too. */
    fun projectOpened(project: Project) {
        if (!project.isDefault) host.foldersChanged()
    }

    fun foldersChanged() = host.foldersChanged()

    /** The file as the registry keeps it; null for a file no agent reaches, as none but local ones are. */
    fun document(file: VirtualFile): DocumentFile? = if (file.isInLocalFileSystem) VirtualFileDocument(file) else null

    /** On the EDT inside a write action, at exit or unload; bounded, it waits on no read lock. */
    override fun dispose() = runtime.dispose()

    companion object {
        fun getInstance(): AgentHubService =
            ApplicationManager.getApplication().getService(AgentHubService::class.java)

        /** The service once something started it, else null; listeners use it so they start nothing. */
        fun getInstanceIfCreated(): AgentHubService? =
            ApplicationManager.getApplication().getServiceIfCreated(AgentHubService::class.java)

        /**
         * The lock's version: this plugin's, as the VS Code extension and the Obsidian plugin give
         * theirs. Its class loader describes the plugin; PluginManagerCore.getPlugin is internal API
         * from 2026.3 on.
         */
        private fun pluginVersion(): String =
            (AgentHubService::class.java.classLoader as? PluginAwareClassLoader)?.pluginDescriptor?.version.orEmpty()

        /**
         * Why coding agents cannot work in this IDE, for the settings page: the service's reason once
         * it started, else the one the IDE gives now, found without starting anything.
         */
        fun whyUnavailable(): String? {
            val service = getInstanceIfCreated() ?: return environmentReason(HubPlatform.current())
            return service.unavailableReason
        }

        private fun environmentReason(platform: HubPlatform): String? {
            val app = ApplicationManager.getApplication()
            return hubUnavailableReason(::jcefSupported, app.isHeadlessEnvironment, app.isUnitTestMode) {
                flatpakSandbox(platform)
            }
        }

        /**
         * Read when the service starts, never at class init: from 2026.2 JCEF is an optional module
         * whose classes may be missing, which throws a LinkageError.
         */
        private fun jcefSupported(): Boolean = try {
            JBCefApp.isSupported()
        } catch (e: LinkageError) {
            false
        }

        /** A Flatpak's pids name no process outside it, so the MCP server would take its lock for a dead one. */
        private fun flatpakSandbox(platform: HubPlatform): Boolean = MachineEnvironment.pidSandbox(
            platform,
            System.getenv(),
            platform == HubPlatform.LINUX && Files.exists(Path.of("/.flatpak-info")),
        )

        private const val HUB_FAILED = "the document hub could not start"
    }
}

/**
 * Why no hub runs, the first that holds, or null. Without JCEF no ERD editor can exist; a headless
 * IDE or a unit-test run has no user for it; in a Flatpak the lock would name a pid no agent sees.
 */
internal fun hubUnavailableReason(
    jcefSupported: () -> Boolean,
    headless: Boolean,
    unitTestMode: Boolean,
    flatpakSandbox: () -> Boolean,
): String? = when {
    !jcefSupported() -> DocumentRules.REASON_NO_JCEF
    headless -> "a headless IDE"
    unitTestMode -> "unit-test mode"
    flatpakSandbox() -> "a Flatpak sandbox"
    else -> null
}
