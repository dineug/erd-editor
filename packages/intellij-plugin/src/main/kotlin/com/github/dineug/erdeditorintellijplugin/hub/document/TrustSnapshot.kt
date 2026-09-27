package com.github.dineug.erdeditorintellijplugin.hub.document

import com.github.dineug.erdeditorintellijplugin.hub.HubPaths
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform

/** One open project: its folders as real paths, and whether the user trusts it. */
data class ProjectTrust(val realFolders: List<String>, val trusted: Boolean)

/**
 * The projects open when a request came, and their trust. One lock covers every project of the
 * IDE, so an agent may reach a folder of a project the user never trusted; the handlers refuse
 * writes there. Built once per request from ide.trustedProjects() and the hub's scope folders. Pure.
 */
class TrustSnapshot(val projects: List<ProjectTrust>, val scopeFolders: List<String>, val platform: HubPlatform) {
    /**
     * Inside at least one untrusted project's folder and no trusted one's; or inside a scope folder
     * but inside no open project's folder, which fails closed while a project opens or closes. A
     * path outside every folder (a document-only file) is not untrusted-only.
     */
    fun untrustedOnly(realPath: String): Boolean {
        val inProjects = projects.filter { project ->
            project.realFolders.any { HubPaths.isInside(it, realPath, platform) }
        }
        if (inProjects.isNotEmpty()) return inProjects.none { it.trusted }
        return scopeFolders.any { HubPaths.isInside(it, realPath, platform) }
    }
}
