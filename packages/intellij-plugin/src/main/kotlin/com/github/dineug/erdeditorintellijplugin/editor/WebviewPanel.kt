package com.github.dineug.erdeditorintellijplugin.editor

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.jcef.JBCefApp
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.cef.CefApp
import org.cef.CefSettings
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.browser.CefMessageRouter
import org.cef.callback.CefQueryCallback
import org.cef.handler.CefDisplayHandlerAdapter
import org.cef.handler.CefMessageRouterHandlerAdapter
import org.intellij.lang.annotations.Language
import java.io.BufferedInputStream
import java.util.concurrent.ConcurrentMap
import java.util.concurrent.atomic.AtomicBoolean
import javax.swing.BorderFactory

class WebviewPanel(
        private val parentDisposable: Disposable,
        private val coroutineScope: CoroutineScope,
        private val bridge: WebviewBridge,
        private val file: VirtualFile,
        private val docToEditorsMap: ConcurrentMap<VirtualFile, MutableSet<ErdEditor>>
) : Disposable {
    companion object {
        private const val DOMAIN = WebviewScripts.DOMAIN
        private const val PLUGIN_URL = WebviewScripts.PLUGIN_URL
        private val mapper = WebviewScripts.mapper
        val isSupported = JBCefApp.isSupported()

        private val schemeHandlerRegistered = AtomicBoolean(false)

        /**
         * Must run before any browser loads [PLUGIN_URL]. Out-of-process JCEF - the default since
         * 2025.x - does not consult a factory registered after the load request has been issued, so
         * Chromium falls through to real DNS and the editor shows DNS_PROBE_FINISHED_NXDOMAIN.
         *
         * Registering once per application also avoids the previous `clearSchemeHandlerFactories()`
         * call, which is global and dropped handlers belonging to the IDE and to other plugins.
         */
        private fun initSchemeHandler() {
            if (schemeHandlerRegistered.get()) return

            // Let the platform bootstrap CEF first. Touching CefApp directly before JBCefApp has
            // initialized creates an unconfigured CefApp, after which JBCefBrowser fails with
            // "JCEF is not supported in this env or failed to initialize".
            JBCefApp.getInstance()

            CefApp.getInstance().registerSchemeHandlerFactory(
                "https", DOMAIN,
                SchemeHandlerFactory { uri ->
                    WebviewPanel::class.java.getResourceAsStream("/assets${uri.path}")?.let {
                        BufferedInputStream(
                            it
                        )
                    }
                }
            ).also { successful -> assert(successful) }

            schemeHandlerRegistered.set(true)
        }
    }

    private val logger = thisLogger()

    // Written on the EDT, read from CEF and coroutine threads.
    @Volatile
    private var isDisposed: Boolean = false

    init {
        initSchemeHandler()
    }

    private val webview = Webview(
            parentDisposable = this,
            url = PLUGIN_URL
    )

    val component = webview.component

    init {
        Disposer.register(parentDisposable, this)
        initPanel()
    }

    private fun initPanel() {
        Disposer.register(this, webview)

        webview.component.border = BorderFactory.createEmptyBorder(2, 2, 2, 2)

        val messageRouter = CefMessageRouter.create()
        object : CefMessageRouterHandlerAdapter() {
            override fun onQuery(
                browser: CefBrowser?,
                frame: CefFrame?,
                queryId: Long,
                request: String?,
                persistent: Boolean,
                callback: CefQueryCallback?
            ): Boolean {
                logger.debug("${file.name} disposed: ${isDisposed}")

                if (isDisposed) {
                    logger.debug("${file.name}: disposed")
                    return false
                }

                // Parsing runs inside a native CEF upcall; an unknown command or malformed payload
                // must not throw across that boundary.
                val action = try {
                    mapper.readValue(request, HostBridgeCommand::class.java)
                } catch (e: Exception) {
                    logger.warn("${file.name}: unparseable bridge command: $request", e)
                    return false
                }

                coroutineScope.launch(Dispatchers.IO + CoroutineName(this::class.java.simpleName)) {
                    bridge.emit(action)
                }

                return true
            }
        }.also { routerHandler ->
            messageRouter.addHandler(routerHandler, true)
            webview.jbCefBrowser.jbCefClient.cefClient.addMessageRouter(messageRouter)
            Disposer.register(this) {
                logger.debug("${file.name}: removing message router")
                webview.jbCefBrowser.jbCefClient.cefClient.removeMessageRouter(messageRouter)
                messageRouter.dispose()
            }
        }

        object : CefDisplayHandlerAdapter() {
            override fun onConsoleMessage(
                browser: CefBrowser?,
                level: CefSettings.LogSeverity?,
                message: String?,
                source: String?,
                line: Int
            ): Boolean {
                if (level == null || message == null || source == null) {
                    logger.warn("${file.name}: Some of required message values were null!")
                    logger.warn("${file.name}: level: $level source: $source:$line\n\tmessage: $message")
                } else {
                    val formattedMessage = "${file.name}: [$level][$source:$line]:\n${message}"

                    when (level) {
                        // Deliberately warn, not error: Logger.error attaches a synthetic throwable
                        // whose stack names this plugin, which makes the IDE raise a "plugin error"
                        // notification for every console.error the bundled web app produces.
                        CefSettings.LogSeverity.LOGSEVERITY_ERROR, CefSettings.LogSeverity.LOGSEVERITY_FATAL -> logger.warn(formattedMessage)
                        CefSettings.LogSeverity.LOGSEVERITY_INFO -> logger.info(formattedMessage)
                        CefSettings.LogSeverity.LOGSEVERITY_WARNING -> logger.warn(formattedMessage)
                        CefSettings.LogSeverity.LOGSEVERITY_VERBOSE -> logger.debug(formattedMessage)
                        else -> logger.info(formattedMessage)
                    }
                }
                return super.onConsoleMessage(browser, level, message, source, line)
            }
        }.also { displayHandler ->
            webview.jbCefBrowser.jbCefClient.addDisplayHandler(displayHandler, webview.jbCefBrowser.cefBrowser)
            Disposer.register(this) {
                logger.debug("${file.name}: removing display handler")
                webview.jbCefBrowser.jbCefClient.removeDisplayHandler(
                    displayHandler,
                    webview.jbCefBrowser.cefBrowser
                )
            }
        }
    }

    private fun runJS(@Language("JavaScript") js: String) {
        if (isDisposed) {
            logger.warn("${file.name}: runJS: controller is disposed")
            return
        }
        val mainFrame = webview.jbCefBrowser.cefBrowser.mainFrame
        if (mainFrame == null) {
            logger.warn("${file.name}: runJS: mainFrame is null")
            return
        }

        mainFrame.executeJavaScript(
            js.trimIndent(),
            mainFrame.url,
            0
        )
    }

    fun dispatch(action: WebviewBridgeCommand) {
        val json = mapper.writeValueAsString(action)
        logger.debug("${file.name}: dispatch")
        runJS(WebviewScripts.postMessageScript(json))
    }

    fun dispatchBroadcast(action: WebviewBridgeCommand) {
        val json = mapper.writeValueAsString(action)
        logger.debug("${file.name}: dispatchBroadcast")

        val script = WebviewScripts.postMessageScript(json)
        // Snapshot before iterating: this runs on a background dispatcher while the EDT may be
        // opening or closing peer editors for the same file.
        docToEditorsMap[file].orEmpty().toList()
            .filter { it !== parentDisposable && it.isWebviewPanelInitialized }
            .forEach { editor -> editor.webviewPanel.runJS(script) }
    }

    override fun dispose() {
        isDisposed = true
    }
}