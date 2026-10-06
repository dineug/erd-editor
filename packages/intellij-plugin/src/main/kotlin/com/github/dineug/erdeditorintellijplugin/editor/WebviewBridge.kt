package com.github.dineug.erdeditorintellijplugin.editor

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import com.fasterxml.jackson.databind.JsonNode
import com.github.dineug.erdeditorintellijplugin.settings.ErdEditorAppSettings
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.progress.ProcessCanceledException
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel

/**
 * One page's host commands, in the order it sent them. CEF calls `onQuery` serially per browser, so
 * [offer] enqueues in arrival order and the one consumer of [subscribe] handles them in that order.
 * The consumer parses them too: a save carries the whole document, and a CEF thread must not wait.
 * [name] is read when a warning is logged, so it names the file as it is called by then.
 */
class WebviewBridge(private val name: () -> String) {
    private val logger = thisLogger()

    private val requests = Channel<String>(Channel.UNLIMITED)

    /** Enqueues a raw request without blocking; false once [close] has run. */
    fun offer(request: String): Boolean = requests.trySend(request).isSuccess

    /**
     * Failures in [block] are contained. Letting one escape would complete the single consuming job
     * exceptionally, and because the owning scope uses a SupervisorJob nothing restarts it - the
     * editor would keep rendering and acknowledging queries while silently saving nothing for the
     * rest of the session. A request that does not parse is logged and skipped the same way.
     */
    fun subscribe(scope: CoroutineScope, block: suspend (HostBridgeCommand) -> Unit): Job =
        scope.launch {
            for (request in requests) {
                val command = try {
                    WebviewScripts.mapper.readValue(request, HostBridgeCommand::class.java)
                } catch (e: Exception) {
                    logger.warn("${name()}: unparseable bridge command: $request", e)
                    continue
                }

                try {
                    block(command)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: ProcessCanceledException) {
                    throw e
                } catch (e: Throwable) {
                    logger.warn("bridge handler failed for ${command::class.simpleName}", e)
                }
            }
        }

    /**
     * Takes no further request. The consumer still handles the ones already offered until its scope is
     * cancelled; ErdEditor.dispose cancels it right after this, so a request still queued then is dropped.
     */
    fun close() {
        requests.close()
    }
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
    JsonSubTypes.Type(value = HostBridgeCommand.SaveTheme::class, name = "hostSaveThemeCommand"),
    JsonSubTypes.Type(value = HostBridgeCommand.SaveLocale::class, name = "hostSaveLocaleCommand")
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
    data class SaveLocale(val payload: HostSaveLocaleCommandPayload): HostBridgeCommand() {
        val type = "hostSaveLocaleCommand"
    }
}
data class HostExportFileCommandPayload(val value: String, val fileName: String)
/** mode is "append" for Import and Add; the page names none for a replace, and this host reads neither. */
data class HostImportFileCommandPayload(
    val type: String,
    val op: String,
    val accept: String,
    val mode: String? = null
)
/** changed is false for a change that left the value as it was; a page that sends none means true. */
data class HostSaveValueCommandPayload(val value: String, val changed: Boolean = true)
// A tree, not Any: Any reads objects as maps, whose null entries the NON_NULL mapper then drops.
data class HostSaveReplicationCommandPayload(val actions: JsonNode)
data class HostSaveThemeCommandPayload(val appearance: String, val grayColor: String, val accentColor: String)
/** A pick from a page's language picker, its System spelled auto. */
data class HostSaveLocaleCommandPayload(val locale: String)

sealed class WebviewBridgeCommand {
    data class ImportFile(val payload: WebviewImportFileCommandPayload) : WebviewBridgeCommand() {
        val type = "webviewImportFileCommand"
    }
    data class InitialValue(val payload: WebviewInitialValueCommandPayload): WebviewBridgeCommand() {
        val type = "webviewInitialValueCommand"
    }
    data class UpdateTheme(val payload: WebviewUpdateThemeCommandPayload): WebviewBridgeCommand() {
        val type = "webviewUpdateThemeCommand"

        companion object {
            /** The stored theme, auto included, with the light or dark auto shows, which the page cannot see. */
            fun of(settings: ErdEditorAppSettings): UpdateTheme {
                val theme = settings.theme
                return UpdateTheme(
                    WebviewUpdateThemeCommandPayload(
                        theme.appearance,
                        theme.grayColor,
                        theme.accentColor,
                        settings.systemAppearance
                    )
                )
            }
        }
    }
    data class UpdateLocale(val payload: WebviewUpdateLocaleCommandPayload): WebviewBridgeCommand() {
        val type = "webviewUpdateLocaleCommand"

        companion object {
            /** The stored display language, auto included, with the IDE's language, which auto follows. */
            fun of(settings: ErdEditorAppSettings) =
                UpdateLocale(WebviewUpdateLocaleCommandPayload(settings.locale, settings.systemLocale))
        }
    }
    data class UpdateReadonly(val payload: Boolean): WebviewBridgeCommand() {
        val type = "webviewUpdateReadonlyCommand"
    }
    data class Replication(val payload: WebviewReplicationCommandPayload): WebviewBridgeCommand() {
        val type = "webviewReplicationCommand"
    }
}
/** mode left null is left out, which a page reads as a replace. */
data class WebviewImportFileCommandPayload(
    val type: String,
    val op: String,
    val value: String,
    val mode: String? = null
)
data class WebviewInitialValueCommandPayload(val value: String)
data class WebviewUpdateThemeCommandPayload(
    val appearance: String?,
    val grayColor: String?,
    val accentColor: String?,
    val systemAppearance: String? = null
)
/** systemLocale left null is left out, which a page reads as keeping the one it has. */
data class WebviewUpdateLocaleCommandPayload(val locale: String, val systemLocale: String? = null)
data class WebviewReplicationCommandPayload(val actions: JsonNode)