package com.github.dineug.erdeditorintellijplugin.settings

import com.github.dineug.erdeditorintellijplugin.agents.AgentHubService
import com.intellij.openapi.options.BoundConfigurable
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.Row
import com.intellij.ui.dsl.builder.bindItem
import com.intellij.ui.dsl.builder.bindSelected
import com.intellij.ui.dsl.builder.panel
import com.intellij.ui.dsl.listCellRenderer.textListCellRenderer

/**
 * Settings | Tools | ERD Editor: the theme of [ErdEditorAppSettings], worded as the Obsidian
 * plugin's settings tab, and the Coding agents switch of [AgentHubSettings].
 */
class ErdEditorConfigurable : BoundConfigurable("ERD Editor") {
    // The fields apply found changed on the page; null is a field the page left alone.
    private var appearance: String? = null
    private var grayColor: String? = null
    private var accentColor: String? = null

    override fun createPanel(): DialogPanel {
        val agents = AgentHubSettings.instance
        return panel {
            row("Appearance:") {
                themeComboBox(ErdEditorTheme.APPEARANCES, { it.appearance }) { appearance = it }
                    .comment(APPEARANCE_COMMENT)
            }
            row("Gray color:") {
                themeComboBox(ErdEditorTheme.GRAY_COLORS, { it.grayColor }) { grayColor = it }
                    .comment(GRAY_COLOR_COMMENT)
            }
            row("Accent color:") {
                themeComboBox(ErdEditorTheme.ACCENT_COLORS, { it.accentColor }) { accentColor = it }
                    .comment(ACCENT_COLOR_COMMENT)
            }
            row { checkBox("Coding agents").bindSelected(agents::codingAgents) }
                .rowComment(agentsComment(AgentHubService.whyUnavailable()))
        }
    }

    /**
     * Lays the fields the page changed over the theme stored at that moment, as one change, so each
     * open editor re-themes once and a builder pick that lands meanwhile keeps its other fields.
     */
    override fun apply() {
        appearance = null
        grayColor = null
        accentColor = null
        super.apply()
        ErdEditorAppSettings.instance.updateTheme { changed(it, appearance, grayColor, accentColor) }
    }

    /** A combo box showing [field] of the stored theme; apply hands a changed pick to [pick]. */
    private fun Row.themeComboBox(
        values: List<String>,
        field: (ErdEditorTheme) -> String,
        pick: (String) -> Unit
    ) = comboBox(values, textListCellRenderer<String?> { it?.let(::optionName) })
        .bindItem({ field(ErdEditorAppSettings.instance.theme) }) { value -> if (value != null) pick(value) }

    internal companion object {
        /** A value as the page names it, with a capital, as the Obsidian plugin's dropdowns do. */
        fun optionName(value: String) = value.replaceFirstChar(Char::uppercaseChar)

        /** The switch's comment, and why the IDE runs no hub as a second line when it runs none. */
        fun agentsComment(unavailableReason: String?): String =
            if (unavailableReason == null) COMMENT
            else "$COMMENT<br>Coding agents are unavailable: $unavailableReason"

        /** [stored] with each field the page changed; a null is a field the page left alone. */
        fun changed(stored: ErdEditorTheme, appearance: String?, grayColor: String?, accentColor: String?) =
            ErdEditorTheme(
                appearance ?: stored.appearance,
                grayColor ?: stored.grayColor,
                accentColor ?: stored.accentColor
            )

        private const val APPEARANCE_COMMENT = "Auto follows the IDE's light or dark theme and " +
            "switches with it. The theme builder in the editor's toolbar changes these three " +
            "settings too."
        private const val GRAY_COLOR_COMMENT = "The neutral color of the canvas, the tables and the menus."
        private const val ACCENT_COLOR_COMMENT = "The color of selections and highlights."
        private const val COMMENT = "Lets a coding agent's ERD Editor MCP server edit the diagrams open in " +
            "this IDE over a local socket. Projects the IDE does not trust are read but never " +
            "changed. When off, agents can still read the ERD files of the open projects but " +
            "cannot change them."
    }
}
