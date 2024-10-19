package com.github.dineug.erdeditorintellijplugin.editor

import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorAppSettings
import com.intellij.openapi.application.ApplicationManager
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
import javax.swing.JComponent
import javax.swing.JPanel
import kotlin.collections.HashMap
import kotlin.collections.HashSet
import kotlin.time.Duration.Companion.milliseconds

@OptIn(FlowPreview::class)
class ErdEditor(
        private val file: VirtualFile,
        private val docToEditorsMap: HashMap<VirtualFile, HashSet<ErdEditor>>
) : UserDataHolderBase(),
        FileEditor,
        DumbAware, ErdEditorAppSettings.SettingsChangedListener {

    private var isDisposed: Boolean = false

    override fun getFile() = file

    lateinit var webviewPanel: WebviewPanel
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
                        val value = file.inputStream.reader().readText()

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
                    return@collectLatest
                }

                readAndWriteAction {
                    writeAction {
                        try {
                            file.getOutputStream(file).use { stream ->
                                with(stream) {
                                    write(value.toByteArray())
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
        docToEditorsMap[file]?.remove(this)
    }
}