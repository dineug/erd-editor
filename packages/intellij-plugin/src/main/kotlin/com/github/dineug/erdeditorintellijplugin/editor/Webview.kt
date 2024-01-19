package com.github.dineug.erdeditorintellijplugin.editor

import com.intellij.CommonBundle
import com.intellij.ide.plugins.MultiPanel
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.editor.EditorBundle
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.SystemInfoRt
import com.intellij.openapi.util.registry.Registry
import com.intellij.ui.components.JBLoadingPanel
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.util.Alarm
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import org.cef.network.CefRequest
import java.awt.BorderLayout
import javax.swing.JComponent

class Webview(
    parentDisposable: Disposable,
    url: String,
) : Disposable {
    companion object {
        private const val LOADING_KEY = 1
        private const val CONTENT_KEY = 0
    }

    private val logger = thisLogger()
    private val alarm = Alarm(this)
    private val loadingPanel = JBLoadingPanel(BorderLayout(), this).apply {
        setLoadingText(CommonBundle.getLoadingTreeNodeText())
    }
    private val multiPanel: MultiPanel = object : MultiPanel() {
        override fun create(key: Int) = when (key) {
            LOADING_KEY -> loadingPanel
            CONTENT_KEY -> jbCefBrowser.component
            else -> throw UnsupportedOperationException("Unknown key")
        }
    }

    val component: JComponent get() = this.multiPanel

    val jbCefBrowser = JBCefBrowser.createBuilder()
        .setEnableOpenDevToolsMenuItem(false)
        .setOffScreenRendering(isOffScreenRenderingEnabled())
        .build()

    init {
        Disposer.register(parentDisposable, this)
        Disposer.register(this, jbCefBrowser)
        jbCefBrowser.loadURL(url)
        multiPanel.select(CONTENT_KEY, true)

        jbCefBrowser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadStart(
                browser: CefBrowser?,
                frame: CefFrame?,
                transitionType: CefRequest.TransitionType?
            ) {
                alarm.addRequest(
                    { jbCefBrowser.loadHTML(EditorBundle.message("message.html.editor.timeout")) },
                    Registry.intValue("html.editor.timeout", 10000)
                )
            }

            override fun onLoadEnd(browser: CefBrowser?, frame: CefFrame?, httpStatusCode: Int) {
                alarm.cancelAllRequests()
            }

            override fun onLoadingStateChange(
                browser: CefBrowser?,
                isLoading: Boolean,
                canGoBack: Boolean,
                canGoForward: Boolean
            ) {
                if (isLoading) {
                    invokeLater {
                        loadingPanel.startLoading()
                        multiPanel.select(LOADING_KEY, true)
                    }
                } else {
                    invokeLater {
                        loadingPanel.stopLoading()
                        multiPanel.select(CONTENT_KEY, true)
                    }
                }
            }
        }, jbCefBrowser.cefBrowser)
    }

    override fun dispose() = Unit;

    private fun isOffScreenRenderingEnabled(): Boolean {
        // Off-screen rendering prevents keyboard access to the editor on Linux and macOS in old versions,
        // therefore disabling it.
        // see: https://youtrack.jetbrains.com/issue/JBR-5348
        // 17.0.6+10-b829.5
        val jvmVersion = System.getProperty("java.vm.version")
        val build: Double = try {
            jvmVersion.replace("[^-]*-b([0-9]*)".toRegex(), "$1").toDouble()
        } catch (e: NumberFormatException) {
            0.0
        }
        // starting from 231.8770.17 / 2023.1.1 EAP off-screen-rendering starts to work
        val result = SystemInfoRt.isWindows || build >= 829.9
        logger.debug("isOffScreenRenderingEnabled: $result")
        return result
    }
}