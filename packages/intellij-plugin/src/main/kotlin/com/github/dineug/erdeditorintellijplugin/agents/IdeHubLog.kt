package com.github.dineug.erdeditorintellijplugin.agents

import com.github.dineug.erdeditorintellijplugin.hub.HUB_LOG_PREFIX
import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.intellij.openapi.diagnostic.ControlFlowException
import com.intellij.openapi.diagnostic.Logger
import java.util.concurrent.CancellationException

/**
 * The hub's lines in idea.log, under a category of their own. Warnings only: Logger.error raises the
 * IDE's plugin error report. A control-flow detail is named rather than attached, since Logger
 * refuses to log a ProcessCanceledException and a cancellation is no failure.
 */
class IdeHubLog(
    private val logger: Logger = Logger.getInstance("#com.github.dineug.erdeditorintellijplugin.hub"),
) : HubLog {
    override fun warn(text: String, detail: Any?) {
        val line = "$HUB_LOG_PREFIX $text"
        when (detail) {
            null -> logger.warn(line)
            is ControlFlowException, is CancellationException -> logger.warn("$line ${detail.javaClass.name}")
            is Throwable -> logger.warn(line, detail)
            else -> logger.warn("$line $detail")
        }
    }

    /** A line that is no warning, such as why this IDE runs no hub. */
    fun info(text: String) {
        logger.info("$HUB_LOG_PREFIX $text")
    }
}
