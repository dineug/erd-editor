package com.github.dineug.erdeditorintellijplugin.editor

import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.EditorColorsScheme
import com.intellij.openapi.editor.colors.ex.DefaultColorSchemesManager
import com.intellij.openapi.editor.colors.impl.EditorColorsManagerImpl
import java.awt.Color

internal object  WebviewThemeStyles {
    fun createStylesheet(): String {
        val scheme = obtainColorScheme()
        val backgroundColor = scheme.defaultBackground.webRgba()
        // language=CSS
        return """
        body {
            background-color: ${backgroundColor};
            color: ${scheme.defaultForeground.webRgba()};
        }
        """.trimIndent()
    }

    private fun obtainColorScheme(): EditorColorsScheme {
        val manager = EditorColorsManager.getInstance() as EditorColorsManagerImpl
        return manager.schemeManager.activeScheme ?: DefaultColorSchemesManager.getInstance().firstScheme
    }

    private fun Color.webRgba(alpha: Double = this.alpha.toDouble()): String {
        return "rgba($red, $green, $blue, $alpha)"
    }
}