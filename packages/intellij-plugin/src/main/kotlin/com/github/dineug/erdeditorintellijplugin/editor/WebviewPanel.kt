package com.github.dineug.erdeditorintellijplugin.editor

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.jcef.JBCefApp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import org.cef.CefApp
import org.cef.CefSettings
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.browser.CefMessageRouter
import org.cef.callback.CefQueryCallback
import org.cef.handler.CefDisplayHandlerAdapter
import org.cef.handler.CefFocusHandlerAdapter
import org.cef.handler.CefMessageRouterHandlerAdapter
import org.intellij.lang.annotations.Language
import java.io.BufferedInputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap
import java.util.concurrent.atomic.AtomicBoolean
import javax.swing.BorderFactory

class WebviewPanel(
        private val parentDisposable: Disposable,
        private val coroutineScope: CoroutineScope,
        private val bridge: WebviewBridge,
        private val file: VirtualFile,
        private val docToEditorsMap: ConcurrentMap<VirtualFile, MutableSet<ErdEditor>>
) : Disposable.Parent {
    companion object {
        private const val DOMAIN = WebviewScripts.DOMAIN
        private const val PLUGIN_URL = WebviewScripts.PLUGIN_URL
        val isSupported = JBCefApp.isSupported()

        private val schemeHandlerRegistered = AtomicBoolean(false)

        /** The panels whose pages may send queries, for a router that hears another tab's page. */
        private val livePanels: MutableSet<WebviewPanel> = ConcurrentHashMap.newKeySet()

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

    // Host commands for this page, encoded and run by one consumer in the order they were
    // dispatched, whichever thread dispatched them; nothing is encoded on the caller's thread.
    private val scripts = Channel<WebviewBridgeCommand>(Channel.UNLIMITED)

    init {
        initSchemeHandler()
    }

    // The editor sets both once the panel exists, and CEF calls them on its own threads. They are
    // declared before the webview, whose construction starts the page loading.
    @Volatile
    var onPageLoadStart: () -> Unit = {}

    /** The page took focus; an agent opening the file shows it without focus, so this never fires then. */
    @Volatile
    var onFocus: () -> Unit = {}

    private val webview = Webview(
            parentDisposable = this,
            url = PLUGIN_URL,
            onLoadStart = { onPageLoadStart() }
    )

    val component = webview.component

    init {
        Disposer.register(parentDisposable, this)
        initPanel()
        launchScriptJob()
    }

    private val ownBrowser: CefBrowser get() = webview.jbCefBrowser.cefBrowser

    /** Takes a query of this panel's page: enqueued for the bridge, then answered. */
    private fun take(request: String?, callback: CefQueryCallback?): Boolean {
        logger.debug("${file.name} disposed: ${isDisposed}")

        if (isDisposed) {
            logger.debug("${file.name}: disposed")
            return false
        }

        // Only enqueued here, in the order CEF delivers the queries: the bridge's consumer parses,
        // so nothing can throw across this native upcall and a save carrying the whole document
        // never holds up the CEF thread.
        if (request == null || !bridge.offer(request)) return false

        // The page ignores the answer, but the router keeps a query it took pending, in the browser
        // and in the renderer, until it is answered or the page goes away.
        callback?.success("")
        return true
    }

    private fun initPanel() {
        Disposer.register(this, webview)
        livePanels += this

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
                // Out-of-process JCEF at 2025.2 hands the queries of every browser to the router
                // registered first, whatever client it was added to: a query of another ERD tab's
                // page goes to that tab's panel, else the page never gets its initial value.
                val panel = if (isSameBrowser(browser, ownBrowser)) {
                    this@WebviewPanel
                } else {
                    livePanels.firstOrNull { it !== this@WebviewPanel && isSameBrowser(browser, it.ownBrowser) }
                        ?: return false
                }
                return panel.take(request, callback)
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

        object : CefFocusHandlerAdapter() {
            override fun onGotFocus(browser: CefBrowser?) = onFocus()
        }.also { focusHandler ->
            webview.jbCefBrowser.jbCefClient.addFocusHandler(focusHandler, webview.jbCefBrowser.cefBrowser)
            Disposer.register(this) {
                logger.debug("${file.name}: removing focus handler")
                webview.jbCefBrowser.jbCefClient.removeFocusHandler(focusHandler, webview.jbCefBrowser.cefBrowser)
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

    /**
     * A failure is logged and the next command still runs: letting one escape would end the only
     * consumer, and the page would silently receive nothing more for the rest of the session.
     */
    private fun launchScriptJob() = coroutineScope.launch(CoroutineName("${file.name}: scripts")) {
        for (command in scripts) {
            try {
                runJS(WebviewScripts.scriptFor(command))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                logger.warn("${file.name}: could not run ${command::class.simpleName}", e)
            }
        }
    }

    fun dispatch(action: WebviewBridgeCommand) {
        logger.debug("${file.name}: dispatch")
        scripts.trySend(action)
    }

    fun dispatchBroadcast(action: WebviewBridgeCommand) {
        logger.debug("${file.name}: dispatchBroadcast")

        // Snapshot before iterating: this runs on a background dispatcher while the EDT may be
        // opening or closing peer editors for the same file.
        docToEditorsMap[file].orEmpty().toList()
            .filter { it !== parentDisposable && it.isWebviewPanelInitialized }
            .forEach { editor -> editor.webviewPanel.dispatch(action) }
    }

    /**
     * The Disposer disposes children first, the browser among them, and this panel last. Scripts run
     * on the consumer's thread, so the flag goes up before the tree is torn down; a script already
     * past the check can still meet a disposed browser, and the consumer logs that and moves on.
     */
    override fun beforeTreeDispose() {
        isDisposed = true
        livePanels -= this
    }

    override fun dispose() {
        isDisposed = true
        livePanels -= this
    }
}

/** Whether a query came from own: the same object or, under out-of-process JCEF, another handle on it. */
internal fun isSameBrowser(browser: CefBrowser?, own: CefBrowser): Boolean =
    browser === own || (browser != null && browser.identifier == own.identifier)
