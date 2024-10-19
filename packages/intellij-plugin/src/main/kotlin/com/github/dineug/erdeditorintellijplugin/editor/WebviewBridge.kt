package com.github.dineug.erdeditorintellijplugin.editor

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class WebviewBridge {
    private val _bridge = MutableSharedFlow<HostBridgeCommand>(replay = 0)
    private val bridge = _bridge.asSharedFlow()

    suspend fun emit(appEvent: HostBridgeCommand) = _bridge.emit(appEvent)

    fun subscribe(scope: CoroutineScope, block: suspend (HostBridgeCommand) -> Unit) = bridge.onEach(block).launchIn(scope)
}

@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.EXISTING_PROPERTY,
    property = "type"
)
@JsonSubTypes(
    JsonSubTypes.Type(value = HostBridgeCommand.ExportFile::class, name = "hostExportFileCommand"),
    JsonSubTypes.Type(value = HostBridgeCommand.ImportFile::class, name = "hostImportFileCommand"),
    JsonSubTypes.Type(value = HostBridgeCommand.Initial::class, name = "hostInitialCommand"),
    JsonSubTypes.Type(value = HostBridgeCommand.SaveValue::class, name = "hostSaveValueCommand"),
    JsonSubTypes.Type(value = HostBridgeCommand.SaveReplication::class, name = "hostSaveReplicationCommand"),
    JsonSubTypes.Type(value = HostBridgeCommand.SaveTheme::class, name = "hostSaveThemeCommand")
)
sealed class HostBridgeCommand {
    data class ExportFile(val payload: HostExportFileCommandPayload) : HostBridgeCommand() {
        val type = "hostExportFileCommand"
    }
    data class ImportFile(val payload: HostImportFileCommandPayload) : HostBridgeCommand() {
        val type = "hostImportFileCommand"
    }
    data object Initial: HostBridgeCommand() {
        val type = "hostInitialCommand"
    }
    data class SaveValue(val payload: HostSaveValueCommandPayload): HostBridgeCommand() {
        val type = "hostSaveValueCommand"
    }
    data class SaveReplication(val payload: HostSaveReplicationCommandPayload): HostBridgeCommand() {
        val type = "hostSaveReplicationCommand"
    }
    data class SaveTheme(val payload: HostSaveThemeCommandPayload): HostBridgeCommand() {
        val type = "hostSaveThemeCommand"
    }
}
data class HostExportFileCommandPayload(val value: String, val fileName: String)
data class HostImportFileCommandPayload(val type: String, val op: String, val accept: String)
data class HostSaveValueCommandPayload(val value: String)
data class HostSaveReplicationCommandPayload(val actions: Any)
data class HostSaveThemeCommandPayload(val appearance: String, val grayColor: String, val accentColor: String)

sealed class WebviewBridgeCommand {
    data class ImportFile(val payload: WebviewImportFileCommandPayload) : WebviewBridgeCommand() {
        val type = "webviewImportFileCommand"
    }
    data class InitialValue(val payload: WebviewInitialValueCommandPayload): WebviewBridgeCommand() {
        val type = "webviewInitialValueCommand"
    }
    data class UpdateTheme(val payload: WebviewUpdateThemeCommandPayload): WebviewBridgeCommand() {
        val type = "webviewUpdateThemeCommand"
    }
    data class UpdateReadonly(val payload: Boolean): WebviewBridgeCommand() {
        val type = "webviewUpdateReadonlyCommand"
    }
    data class Replication(val payload: WebviewReplicationCommandPayload): WebviewBridgeCommand() {
        val type = "webviewReplicationCommand"
    }
}
data class WebviewImportFileCommandPayload(val type: String, val op: String, val value: String)
data class WebviewInitialValueCommandPayload(val value: String)
data class WebviewUpdateThemeCommandPayload(val appearance: String?, val grayColor: String?, val accentColor: String?)
data class WebviewReplicationCommandPayload(val actions: Any)