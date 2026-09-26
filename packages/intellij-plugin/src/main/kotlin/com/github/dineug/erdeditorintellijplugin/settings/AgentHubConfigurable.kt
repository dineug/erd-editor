package com.github.dineug.erdeditorintellijplugin.settings

import com.intellij.openapi.options.BoundConfigurable
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.bindSelected
import com.intellij.ui.dsl.builder.panel

/** Settings | Tools | ERD Editor: the Coding agents switch of [AgentHubSettings]. */
class AgentHubConfigurable : BoundConfigurable("ERD Editor") {
    override fun createPanel(): DialogPanel {
        val settings = AgentHubSettings.instance
        return panel {
            row { checkBox("Coding agents").bindSelected(settings::codingAgents) }.rowComment(COMMENT)
        }
    }

    private companion object {
        const val COMMENT = "Lets a coding agent's ERD Editor MCP server edit the diagrams open in " +
            "this IDE over a local socket. Projects the IDE does not trust are read but never " +
            "changed. When off, agents can still read the ERD files of the open projects but " +
            "cannot change them."
    }
}
