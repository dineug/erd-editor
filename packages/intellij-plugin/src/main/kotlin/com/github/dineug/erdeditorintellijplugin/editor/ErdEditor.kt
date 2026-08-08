package com.github.dineug.erdeditorintellijplugin.editor

import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorAppSettings
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.application.readAndWriteAction
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
        DumbAware, ErdEditorAppSettings.SettingsChangedListener {

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
    private val bridge = WebviewBridge()
    private val savePayload = MutableStateFlow<String?>(null)

    private val coroutineScope: CoroutineScope =
            CoroutineScope(SupervisorJob() + CoroutineName("${this::class.java.simpleName}:${file.name}"))

    init {
        val busConnection = ApplicationManager.getApplication().messageBus.connect(this)
        with(busConnection) {
            subscribe(ErdEditorAppSettings.SettingsChangedListener.TOPIC, this@ErdEditor)
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
                        val value = file.inputStream.use { it.reader(Charsets.UTF_8).readText() }

                        webviewPanel.dispatch(
                            WebviewBridgeCommand.UpdateTheme(
                                WebviewUpdateThemeCommandPayload(
                                    settings.state.appearance,
                                    settings.state.grayColor,
                                    settings.state.accentColor
                                )
                            )
                        )
                        webviewPanel.dispatch(
                            WebviewBridgeCommand.UpdateReadonly(file.isWritable.not())
                        )
                        webviewPanel.dispatch(
                            WebviewBridgeCommand.InitialValue(
                                WebviewInitialValueCommandPayload(value)
                            )
                        )
                    }

                    is HostBridgeCommand.SaveValue -> {
                        savePayload.value = action.payload.value
                    }

                    is HostBridgeCommand.SaveReplication -> {
                        webviewPanel.dispatchBroadcast(
                            WebviewBridgeCommand.Replication(
                                WebviewReplicationCommandPayload(
                                    action.payload.actions
                                )
                            )
                        )
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
                                        readAndWriteAction {
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
                        val settings = ErdEditorAppSettings.instance
                        settings.setTheme(ErdEditorAppSettings.State(
                            action.payload.appearance,
                            action.payload.grayColor,
                            action.payload.accentColor
                        ))
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
            launchSaveJob()
        }
    }

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

                readAndWriteAction {
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
            webviewPanel.dispatch(
                WebviewBridgeCommand.UpdateTheme(
                    WebviewUpdateThemeCommandPayload(
                        settings.state.appearance,
                        settings.state.grayColor,
                        settings.state.accentColor
                    )
                )
            )
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
        docToEditorsMap.computeIfPresent(file) { _, editors ->
            editors.remove(this)
            if (editors.isEmpty()) null else editors
        }

        // Order matters: flush before cancelling, otherwise the cancellation wins the race and the
        // last edit is lost for good.
        flushPendingSave()
        coroutineScope.cancel()
    }
}