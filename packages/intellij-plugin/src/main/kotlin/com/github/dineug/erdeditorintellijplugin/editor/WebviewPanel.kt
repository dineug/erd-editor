package com.github.dineug.erdeditorintellijplugin.editor

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.debug
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.jcef.JBCefApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.browser.CefMessageRouter
import org.cef.callback.CefQueryCallback
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
                logger.debug { "${file.name} disposed: ${isDisposed}" }

                val action = mapper.readValue(request, VscodeBridgeAction::class.java)

                if (isDisposed) {
                    logger.debug("${file.name}: disposed")
                    return false
                }

                coroutineScope.launch(Dispatchers.IO) {
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

    fun dispatch(action: WebviewBridgeAction) {
        val json = mapper.writeValueAsString(action)
        logger.debug("${file.name}: dispatch")
        runJS("window.postMessage(JSON.parse(String.raw`$json`), 'https://$DOMAIN')")
    }

    fun dispatchBroadcast(action: WebviewBridgeAction) {
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