package com.github.dineug.erdeditorintellijplugin.editor

import com.intellij.openapi.project.DumbAware
import com.intellij.ui.ColorUtil
import com.intellij.ui.components.JBScrollPane
import com.intellij.util.ui.UIUtil
import javax.swing.BorderFactory
import javax.swing.JPanel
import javax.swing.JTextPane

class JCEFUnsupportedViewPanel : JPanel(), DumbAware {
    private val textPane = JTextPane()
    private val scrollPane = JBScrollPane(textPane)

    init {
        with(textPane) {
            isEditable = false
            contentType = UIUtil.HTML_MIME
            text =
                """
                <html lang="en">
                <body style="color: #${ColorUtil.toHex(UIUtil.getTextFieldForeground())}">
                <h2>JCEF is not available!</h2>
                <p>
                    <strong>Please ensure the IDE is running with the Jetbrains Runtime.</strong>
                </p>
                <p>
                    This plugin requires JCEF (Chromium Embedded Frame) to load the ERD Editor webapp. 
                </p>
                <p>
                    JCEF can be unsupported when it’s not available in the IDE's JVM runtime,<br>
                    the IDE is started with an alternative OpenJDK.
                </p>
                </body>
                </html>
                """.trimIndent()
            border = BorderFactory.createEmptyBorder(20, 20, 20, 20)
        }
        add(scrollPane)
    }
}