package com.github.dineug.erdeditorintellijplugin.agents

import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

/**
 * Starts the hub with the first project, and runs for every project opened later, and for each one
 * open when the plugin is loaded. DumbAware, so it does not wait for indexing.
 */
class AgentHubStartupActivity : ProjectActivity, DumbAware {
    override suspend fun execute(project: Project) {
        AgentHubService.getInstance().projectOpened(project)
    }
}
