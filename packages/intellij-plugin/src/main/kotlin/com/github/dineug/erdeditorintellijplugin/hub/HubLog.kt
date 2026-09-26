package com.github.dineug.erdeditorintellijplugin.hub

/** The prefix of every hub log line, the same in the VS Code and Obsidian hosts' logs. */
const val HUB_LOG_PREFIX: String = "[erd-editor hub]"

/**
 * One warning line: the implementation writes "$HUB_LOG_PREFIX $text" plus detail (a Throwable is
 * attached as such). The hub never logs an error: outside an Application, Logger.error throws.
 */
interface HubLog {
    fun warn(text: String, detail: Any? = null)
}
