package com.github.dineug.erdeditorintellijplugin.editor

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
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
import javax.swing.BorderFactory

class WebviewPanel(
        private val parentDisposable: Disposable,
        private val coroutineScope: CoroutineScope,
        private val bridge: WebviewBridge,
        private val file: VirtualFile,
        private val docToEditorsMap: HashMap<VirtualFile, HashSet<ErdEditor>>
) : Disposable {
    companion object {
        private const val DOMAIN = "erd-editor-jetbrains-plugin"
        private const val PLUGIN_URL = "https://$DOMAIN/index.html"
        private val mapper = jacksonObjectMapper().apply {
            configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            setSerializationInclusion(JsonInclude.Include.NON_NULL)
        }
        val isSupported = JBCefApp.isSupported()

        private fun initSchemeHandler() {
            CefApp.getInstance().clearSchemeHandlerFactories()
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
        }
    }

    private val logger = thisLogger()
    private var isDisposed: Boolean = false

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
        initSchemeHandler()
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

                val action = mapper.readValue(request, HostBridgeCommand::class.java)

                if (isDisposed) {
                    logger.debug("${file.name}: disposed")
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
                        CefSettings.LogSeverity.LOGSEVERITY_ERROR, CefSettings.LogSeverity.LOGSEVERITY_FATAL -> logger.error(formattedMessage)
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
        runJS("window.postMessage(JSON.parse(String.raw`$json`), 'https://$DOMAIN')")
    }

    fun dispatchBroadcast(action: WebviewBridgeCommand) {
        val json = mapper.writeValueAsString(action)
        logger.debug("${file.name}: dispatchBroadcast")

        docToEditorsMap[file]?.filter { it != parentDisposable }?.forEach { editor ->
            editor.webviewPanel.runJS("window.postMessage(JSON.parse(String.raw`$json`), 'https://$DOMAIN')")
        }
    }

    override fun dispose() {
        isDisposed = true
    }
}