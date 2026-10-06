package com.github.dineug.erdeditorintellijplugin.editor

import com.fasterxml.jackson.databind.node.ArrayNode
import com.github.dineug.erdeditorintellijplugin.agents.AgentHubService
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentRegistry
import com.github.dineug.erdeditorintellijplugin.hub.document.HubView
import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorAppSettings
import com.intellij.ide.ui.LafManagerListener
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.EDT
import com.intellij.openapi.application.ModalityState
import com.intellij.openapi.application.asContextElement
import com.intellij.openapi.application.edtWriteAction
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.application.readAndEdtWriteAction
import com.intellij.openapi.fileChooser.FileChooserFactory
import com.intellij.openapi.fileChooser.FileSaverDescriptor
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorState
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.util.UserDataHolderBase
import com.intellij.openapi.vfs.VirtualFile
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.filterNotNull
import java.awt.BorderLayout
import java.beans.PropertyChangeListener
import java.io.IOException
import java.util.*
import java.util.concurrent.ConcurrentMap
import javax.swing.JComponent
import javax.swing.JPanel
import kotlin.collections.HashMap
import kotlin.collections.HashSet
import kotlin.time.Duration.Companion.milliseconds

@OptIn(FlowPreview::class)
class ErdEditor(
        private val file: VirtualFile,
        private val docToEditorsMap: ConcurrentMap<VirtualFile, MutableSet<ErdEditor>>
) : UserDataHolderBase(),
        FileEditor,
        DumbAware, ErdEditorAppSettings.SettingsChangedListener, HubView {

    // Flipped on the EDT in dispose(), read from coroutine and CEF threads.
    @Volatile
    private var isDisposed: Boolean = false

    @Volatile
    private var lastWrittenValue: String? = null

    override fun getFile() = file

    lateinit var webviewPanel: WebviewPanel

    val isWebviewPanelInitialized: Boolean get() = this::webviewPanel.isInitialized
    private val jcefUnsupported by lazy { JCEFUnsupportedViewPanel() }
    private val toolbarAndWebView: JPanel
    private val bridge = WebviewBridge { file.name }
    private val savePayload = MutableStateFlow<String?>(null)

    private val coroutineScope: CoroutineScope =
            CoroutineScope(SupervisorJob() + CoroutineName("${this::class.java.simpleName}:${file.name}"))

    // The coding-agent hub, declared before init builds the page: its first command needs them.
    private val service = AgentHubService.getInstance()
    private val timings = service.runtime.timings
    private val registry = service.runtime.registry

    /** This editor's file as the hub's registry keeps it; null for one no agent reaches, and without JCEF. */
    private val document: DocumentFile? = if (WebviewPanel.isSupported) service.document(file) else null

    init {
        val busConnection = ApplicationManager.getApplication().messageBus.connect(this)
        with(busConnection) {
            subscribe(ErdEditorAppSettings.SettingsChangedListener.TOPIC, this@ErdEditor)
            // Auto shows the IDE's light or dark, which the page keeps for its theme builder to pick.
            subscribe(LafManagerListener.TOPIC, LafManagerListener {
                onSettingsChange(ErdEditorAppSettings.instance)
            })
        }

        initViewIfSupported().also {
            toolbarAndWebView = object : JPanel(BorderLayout()) {
                init {
                    when {
                        this@ErdEditor::webviewPanel.isInitialized -> {
                            add(webviewPanel.component, BorderLayout.CENTER)
                        }

                        else -> add(jcefUnsupported, BorderLayout.CENTER)
                    }
                }
            }
        }
    }

    private fun initViewIfSupported() {
        if (WebviewPanel.isSupported) {
            bridge.subscribe(coroutineScope) { action ->
                when (action) {
                    is HostBridgeCommand.Initial -> {
                        val settings = ErdEditorAppSettings.instance
                        webviewPanel.dispatch(WebviewBridgeCommand.UpdateTheme.of(settings))
                        webviewPanel.dispatch(WebviewBridgeCommand.UpdateLocale.of(settings))
                        webviewPanel.dispatch(
                            WebviewBridgeCommand.UpdateReadonly(file.isWritable.not())
                        )
                        // Through the VFS, which drops a byte order mark.
                        val value = file.inputStream.use { it.reader(Charsets.UTF_8).readText() }

                        holdForLock()
                        // The registry picks the value, its mirror once quiet or the file's, and readies
                        // the page in the same step, so every batch it injects later follows the value.
                        postHeld({ sendInitialValue(value) }) { onViewReady(it, this@ErdEditor, value) }
                    }

                    is HostBridgeCommand.SaveValue -> {
                        val (value, changed) = action.payload
                        // A save that changed nothing, as after a scroll the file does not keep, is not written.
                        if (changed) savePayload.value = value
                        postForFile { onValueSaved(it, this@ErdEditor, value.takeIf { changed }) }
                    }

                    is HostBridgeCommand.SaveReplication -> {
                        val actions = action.payload.actions
                        // A held document relays through the registry, to its ready pages and its peers.
                        postHeld({
                            webviewPanel.dispatchBroadcast(
                                WebviewBridgeCommand.Replication(
                                    WebviewReplicationCommandPayload(
                                        actions
                                    )
                                )
                            )
                        }) { onViewActions(it, this@ErdEditor, actions) }
                    }

                    is HostBridgeCommand.ImportFile -> {}

                    is HostBridgeCommand.ExportFile -> {
                        val byteArray = Base64.getDecoder().decode(action.payload.value)
                        val extension = action.payload.fileName.substringAfterLast(".", "")
                        val descriptor = FileSaverDescriptor(
                            "Export $extension To",
                            "Choose the $extension destination",
                            extension
                        )

                        // https://youtrack.jetbrains.com/issue/IDEA-309222/java.lang.Throwable-Assert-must-be-called-on-EDT
                        ApplicationManager.getApplication().invokeLater {
                            FileChooserFactory.getInstance()
                                .createSaveFileDialog(descriptor, null)
                                .save(file.parent, action.payload.fileName)?.also { destination ->
                                    coroutineScope.launch(Dispatchers.IO + CoroutineName(this::class.java.simpleName)) {
                                        readAndEdtWriteAction {
                                            writeAction {
                                                val file = destination.getVirtualFile(true)!!
                                                try {
                                                    file.getOutputStream(file).use { stream ->
                                                        with(stream) {
                                                            write(byteArray)
                                                        }
                                                    }
                                                } catch (e: IOException) {
                                                    // TODO: notifyAboutWriteError
                                                } catch (e: IllegalArgumentException) {
                                                    // TODO: notifyAboutWriteError
                                                }
                                            }
                                        }
                                    }
                                }
                        }
                    }

                    is HostBridgeCommand.SaveTheme -> {
                        ErdEditorAppSettings.instance.setThemeFromBuilder(
                            action.payload.appearance,
                            action.payload.grayColor,
                            action.payload.accentColor
                        )
                    }

                    is HostBridgeCommand.SaveLocale -> {
                        ErdEditorAppSettings.instance.updateLocale(action.payload.locale)
                    }
                }
            }

            // Posted before the panel exists, whose page starts loading at once, so the page's first
            // command reaches the registry after them.
            document?.let { doc ->
                registry.post {
                    // Editors the registry let go of (the file renamed away and back) relay among
                    // themselves; a new one of that file joins them, so every page reaches every other.
                    if (docToEditorsMap[file].orEmpty().all { it === this@ErdEditor || holds(doc, it) }) {
                        register(doc)
                        addView(doc, this@ErdEditor)
                    }
                }
            }
            webviewPanel = WebviewPanel(
                this,
                coroutineScope,
                bridge,
                file,
                docToEditorsMap
            )
            if (document != null) {
                // A new page holds nothing until it asks for its initial value again.
                webviewPanel.onPageLoadStart = { postForFile { onViewUnready(it, this@ErdEditor) } }
                webviewPanel.onFocus = { postForFile { setActive(it) } }
            }
            launchSaveJob()
        }
    }

    /**
     * Holds the page's initial value, initialValueHoldMs at most, until the lock lists the file, so an
     * agent finds the document before the page takes an edit. The hub's threads stopping ends the hold.
     */
    private suspend fun holdForLock() {
        val doc = document ?: return
        if (hubStopped) return
        try {
            withTimeoutOrNull(timings.initialValueHoldMs) {
                registry.call { awaitListed(doc, timings.initialValueHoldMs) }
            }
        } catch (e: CancellationException) {
            // A call the stopped registry refused; this editor's own cancellation goes on.
            currentCoroutineContext().ensureActive()
        }
    }

    /**
     * Runs block on the registry thread while it holds this editor as a view of its file, else
     * unregistered: for a file no agent reaches, an editor the registry let go of (its file renamed to
     * another extension) or one that joined those, and once the hub's threads stopped.
     */
    private fun postHeld(unregistered: () -> Unit, block: DocumentRegistry.(DocumentFile) -> Unit) {
        val doc = document
        if (doc == null || hubStopped) return unregistered()
        registry.post { if (holds(doc)) block(doc) else unregistered() }
    }

    /** Runs block on the registry thread for this editor's file; the registry ignores a file it does not hold. */
    private fun postForFile(block: DocumentRegistry.(DocumentFile) -> Unit) {
        document?.let { doc -> registry.post { block(doc) } }
    }

    private fun DocumentRegistry.holds(doc: DocumentFile, editor: ErdEditor = this@ErdEditor): Boolean =
        documents().any { it.file == doc && editor in it.views }

    private val hubStopped: Boolean get() = service.runtime.threads.registryExecutor.isShutdown

    override fun sendInitialValue(value: String) {
        webviewPanel.dispatch(WebviewBridgeCommand.InitialValue(WebviewInitialValueCommandPayload(value)))
    }

    override fun inject(actions: ArrayNode) {
        webviewPanel.dispatch(WebviewBridgeCommand.Replication(WebviewReplicationCommandPayload(actions)))
    }

    // Before the page exists there is nothing to tell: its first command reads the file's writability.
    override fun pushReadonly(readonly: Boolean) {
        if (isWebviewPanelInitialized) webviewPanel.dispatch(WebviewBridgeCommand.UpdateReadonly(readonly))
    }

    /**
     * The hub's save: latest() written now rather than after the autosave debounce, read inside the
     * write action, so an autosave that landed meanwhile is never overwritten with older bytes. Both
     * run on the EDT at NON_MODAL, in the order they came. Bounded; the hub logs a save that failed.
     */
    override suspend fun writeNow(latest: () -> String): Boolean {
        if (!canWrite()) return false
        return withTimeoutOrNull(timings.saveWriteBoundMs) {
            withContext(Dispatchers.EDT + ModalityState.nonModal().asContextElement()) {
                edtWriteAction {
                    // A tab closed meanwhile flushed its own newer value, and nothing older may follow it.
                    if (!canWrite()) return@edtWriteAction false
                    val value = latest()
                    if (value != lastWrittenValue) writeValue(value)
                    // Judged inside the action: an autosave queued behind it may write a newer value.
                    lastWrittenValue == value
                }
            }
        } ?: false
    }

    private fun canWrite(): Boolean = !isDisposed && file.isValid && file.isWritable

    private fun launchSaveJob() = coroutineScope.launch {
        savePayload
            .debounce(100.milliseconds)
            .filterNotNull()
            .collectLatest { value ->
                if (isDisposed) {
                    return@collectLatest
                }

                if (!file.isWritable) {
                    // The read-only flag is otherwise pushed only once, during the initial
                    // handshake. Without this the web app keeps accepting edits that are dropped.
                    webviewPanel.dispatch(WebviewBridgeCommand.UpdateReadonly(true))
                    return@collectLatest
                }

                readAndEdtWriteAction {
                    writeAction {
                        writeValue(value)
                    }
                }
            }
    }

    private fun writeValue(value: String) {
        try {
            file.getOutputStream(file).use { stream ->
                stream.write(value.toByteArray(Charsets.UTF_8))
            }
            lastWrittenValue = value
            postForFile { onWritten(it, value) }
        } catch (e: IOException) {
            reportWriteFailure(e)
        } catch (e: IllegalArgumentException) {
            reportWriteFailure(e)
        }
    }

    private fun reportWriteFailure(e: Exception) {
        thisLogger().warn("Failed to save ${file.name}", e)
        NotificationGroupManager.getInstance()
            .getNotificationGroup("ERD Editor")
            .createNotification(
                "Could not save ${file.name}",
                e.message ?: e.javaClass.simpleName,
                NotificationType.ERROR
            )
            .notify(null)
    }

    /**
     * The debounced save job bails out once [isDisposed] is set, so a value still inside the debounce
     * window when the tab closes would be discarded without ever reaching disk. Write it here, before
     * the scope is cancelled. [VirtualFile.isValid] keeps a deleted file from being recreated.
     */
    private fun flushPendingSave() {
        val pending = savePayload.value ?: return
        if (pending == lastWrittenValue) return
        if (!file.isValid || !file.isWritable) return

        val application = ApplicationManager.getApplication()
        try {
            application.invokeAndWait {
                application.runWriteAction { writeValue(pending) }
            }
        } catch (e: Exception) {
            thisLogger().warn("Failed to flush pending changes of ${file.name} on close", e)
        }
    }

    override fun onSettingsChange(settings: ErdEditorAppSettings) {
        if (this::webviewPanel.isInitialized) {
            webviewPanel.dispatch(WebviewBridgeCommand.UpdateTheme.of(settings))
            webviewPanel.dispatch(WebviewBridgeCommand.UpdateLocale.of(settings))
        }
    }

    override fun getComponent(): JComponent = toolbarAndWebView

    override fun getPreferredFocusedComponent() = toolbarAndWebView

    override fun getName() = "ERD Editor"

    override fun setState(state: FileEditorState) {
    }

    override fun isModified(): Boolean {
        return false
    }

    override fun isValid(): Boolean {
        return true
    }

    override fun addPropertyChangeListener(listener: PropertyChangeListener) {
    }

    override fun removePropertyChangeListener(listener: PropertyChangeListener) {
    }

    override fun dispose() {
        isDisposed = true
        bridge.close()
        docToEditorsMap.computeIfPresent(file) { _, editors ->
            editors.remove(this)
            if (editors.isEmpty()) null else editors
        }

        // Order matters: flush before cancelling, otherwise the cancellation wins the race and the
        // last edit is lost for good. The registry hears of the flush first; the last view to go
        // takes the document out of the lock and tells its peers.
        flushPendingSave()
        postForFile { removeView(it, this@ErdEditor) }
        coroutineScope.cancel()
    }
}