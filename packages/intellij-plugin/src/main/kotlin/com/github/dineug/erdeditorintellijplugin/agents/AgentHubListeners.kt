package com.github.dineug.erdeditorintellijplugin.agents

import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentFile
import com.intellij.ide.AppLifecycleListener
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectCloseListener
import com.intellij.openapi.roots.ModuleRootEvent
import com.intellij.openapi.roots.ModuleRootListener
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.openapi.vfs.newvfs.events.VFileMoveEvent
import com.intellij.openapi.vfs.newvfs.events.VFilePropertyChangeEvent

// The platform's events the hub follows. Each reaches the service only once something started it,
// and hands its work to the hub's threads: none waits on the EDT or inside a write action.

/** The IDE is closing, before its projects close: every peer hears documentClosed while it can still read. */
class AgentHubAppListener : AppLifecycleListener {
    override fun appWillBeClosed(isRestart: Boolean) {
        AgentHubService.getInstanceIfCreated()?.runtime?.shutdownPeers()
    }
}

/** A closed project's folders leave the lock. */
class AgentHubProjectCloseListener : ProjectCloseListener {
    override fun projectClosed(project: Project) {
        AgentHubService.getInstanceIfCreated()?.foldersChanged()
    }
}

/** A project's content roots changed; storms of these, library and SDK changes among them, coalesce. */
class AgentHubRootsListener(private val project: Project) : ModuleRootListener {
    override fun rootsChanged(event: ModuleRootEvent) {
        // The default project's roots never reach the lock.
        if (project.isDefault) return
        AgentHubService.getInstanceIfCreated()?.foldersChanged()
    }
}

/**
 * A local file or folder renamed or moved: a folder moves every diagram under it, so the registry
 * reads every document's path again. A file that became writable or read-only: its pages and peers learn it.
 */
class AgentHubVfsListener : BulkFileListener {
    override fun after(events: List<VFileEvent>) {
        val service = AgentHubService.getInstanceIfCreated() ?: return
        var moved = false
        val writability = ArrayList<DocumentFile>()
        for (event in events) {
            val file = event.file ?: continue
            if (!file.isInLocalFileSystem) continue
            when {
                event is VFileMoveEvent -> moved = true
                event !is VFilePropertyChangeEvent -> continue
                event.propertyName == VirtualFile.PROP_NAME -> moved = true
                // The registry ignores a file it does not hold.
                event.propertyName == VirtualFile.PROP_WRITABLE && !file.isDirectory -> {
                    writability += VirtualFileDocument(file)
                }
            }
        }
        if (!moved && writability.isEmpty()) return
        service.runtime.registry.post {
            if (moved) pathsMayHaveChanged()
            writability.forEach { writabilityChanged(it) }
        }
    }
}
