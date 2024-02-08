package com.github.dineug.erdeditorintellijplugin.editor

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class WebviewBridge {
    private val _bridge = MutableSharedFlow<VscodeBridgeAction>(replay = 0)
    private val bridge = _bridge.asSharedFlow()

    suspend fun emit(appEvent: VscodeBridgeAction) = _bridge.emit(appEvent)

    fun subscribe(scope: CoroutineScope, block: suspend (VscodeBridgeAction) -> Unit) = bridge.onEach(block).launchIn(scope)
}

@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.EXISTING_PROPERTY,
    property = "type"
)
@JsonSubTypes(
    JsonSubTypes.Type(value = VscodeBridgeAction.VscodeExportFile::class, name = "vscodeExportFile"),
    JsonSubTypes.Type(value = VscodeBridgeAction.VscodeImportFile::class, name = "vscodeImportFile"),
    JsonSubTypes.Type(value = VscodeBridgeAction.VscodeInitial::class, name = "vscodeInitial"),
    JsonSubTypes.Type(value = VscodeBridgeAction.VscodeSaveValue::class, name = "vscodeSaveValue"),
    JsonSubTypes.Type(value = VscodeBridgeAction.VscodeSaveReplication::class, name = "vscodeSaveReplication"),
    JsonSubTypes.Type(value = VscodeBridgeAction.VscodeSaveTheme::class, name = "vscodeSaveTheme")
)
sealed class VscodeBridgeAction {
    data class VscodeExportFile(val payload: VscodeExportFilePayload) : VscodeBridgeAction() {
        val type = "vscodeExportFile"
    }
    data class VscodeImportFile(val payload: VscodeImportFilePayload) : VscodeBridgeAction() {
        val type = "vscodeImportFile"
    }
    data object VscodeInitial: VscodeBridgeAction() {
        val type = "vscodeInitial"
    }
    data class VscodeSaveValue(val payload: VscodeSaveValuePayload): VscodeBridgeAction() {
        val type = "vscodeSaveValue"
    }
    data class VscodeSaveReplication(val payload: VscodeSaveReplicationPayload): VscodeBridgeAction() {
        val type = "vscodeSaveReplication"
    }
    data class VscodeSaveTheme(val payload: VscodeSaveThemePayload): VscodeBridgeAction() {
        val type = "vscodeSaveTheme"
    }
}
data class VscodeExportFilePayload(val value: String, val fileName: String)
data class VscodeImportFilePayload(val type: String, val op: String, val accept: String)
data class VscodeSaveValuePayload(val value: String)
data class VscodeSaveReplicationPayload(val actions: Any)
data class VscodeSaveThemePayload(val appearance: String, val grayColor: String, val accentColor: String)

sealed class WebviewBridgeAction {
    data class WebviewImportFile(val payload: WebviewImportFilePayload) : WebviewBridgeAction() {
        val type = "webviewImportFile"
    }
    data class WebviewInitialValue(val payload: WebviewInitialValuePayload): WebviewBridgeAction() {
        val type = "webviewInitialValue"
    }
    data class WebviewUpdateTheme(val payload: WebviewUpdateThemePayload): WebviewBridgeAction() {
        val type = "webviewUpdateTheme"
    }
    data class WebviewUpdateReadonly(val payload: Boolean): WebviewBridgeAction() {
        val type = "webviewUpdateReadonly"
    }
    data class WebviewReplication(val payload: WebviewReplicationPayload): WebviewBridgeAction() {
        val type = "webviewReplication"
    }
}
data class WebviewImportFilePayload(val type: String, val op: String, val value: String)
data class WebviewInitialValuePayload(val value: String)
data class WebviewUpdateThemePayload(val appearance: String?, val grayColor: String?, val accentColor: String?)
data class WebviewReplicationPayload(val actions: Any)