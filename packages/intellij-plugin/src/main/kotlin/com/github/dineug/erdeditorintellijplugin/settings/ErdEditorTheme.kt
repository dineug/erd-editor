package com.github.dineug.erdeditorintellijplugin.settings

/**
 * The three theme values the settings page, the stored state and a page's theme builder share. The
 * rules are the Obsidian plugin's (packages/obsidian-plugin/src/settings.ts); the value lists are
 * packages/webview-bridge's, which ErdEditorThemeTest reads to catch a drift.
 */
data class ErdEditorTheme(val appearance: String, val grayColor: String, val accentColor: String) {

    companion object {
        const val AUTO = "auto"
        const val LIGHT = "light"
        const val DARK = "dark"

        val APPEARANCES = listOf(AUTO, LIGHT, DARK)
        val GRAY_COLORS = listOf("gray", "mauve", "slate", "sage", "olive", "sand")
        val ACCENT_COLORS = listOf(
            "gray", "gold", "bronze", "brown", "yellow", "amber", "orange", "tomato", "red", "ruby",
            "crimson", "pink", "plum", "purple", "violet", "iris", "indigo", "blue", "cyan", "teal",
            "jade", "green", "grass", "lime", "mint", "sky"
        )

        /** Auto follows the IDE, as the Obsidian plugin's default does; the colors are the editor's. */
        val DEFAULT = ErdEditorTheme(AUTO, "slate", "indigo")

        /** The light or dark auto shows. */
        fun systemAppearance(ideDark: Boolean) = if (ideDark) DARK else LIGHT

        /** The three values, each one that is missing or unknown taken from [fallback]. */
        fun read(
            appearance: String?,
            grayColor: String?,
            accentColor: String?,
            fallback: ErdEditorTheme
        ) = ErdEditorTheme(
            oneOf(appearance, APPEARANCES, fallback.appearance),
            oneOf(grayColor, GRAY_COLORS, fallback.grayColor),
            oneOf(accentColor, ACCENT_COLORS, fallback.accentColor)
        )

        private fun oneOf(value: String?, allowed: List<String>, fallback: String) =
            if (value != null && value in allowed) value else fallback
    }
}
