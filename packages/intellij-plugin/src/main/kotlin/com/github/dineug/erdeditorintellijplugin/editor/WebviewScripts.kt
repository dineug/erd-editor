package com.github.dineug.erdeditorintellijplugin.editor

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper

/**
 * JSON and JavaScript plumbing for the webview bridge.
 *
 * Deliberately free of any JCEF or IntelliJ dependency: this is the part of the bridge whose
 * correctness is subtle enough to need unit tests, and those must run without booting an IDE.
 */
object WebviewScripts {
    const val DOMAIN = "erd-editor-jetbrains-plugin"
    const val PLUGIN_URL = "https://$DOMAIN/index.html"

    val mapper = jacksonObjectMapper().apply {
        configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
        setSerializationInclusion(JsonInclude.Include.NON_NULL)
    }

    /**
     * Builds the `window.postMessage` call, embedding [json] as a JS *string literal*.
     *
     * It must not be spliced into a template literal. JSON escaping covers only `"`, `\` and control
     * characters, so a backtick or `${'$'}{` in any table name, comment or default value survives
     * verbatim: inside `String.raw` a single backtick aborted the whole script - leaving the editor
     * permanently blank, because the web app attaches itself only while handling
     * webviewInitialValueCommand - and `${'$'}{...}` was evaluated as JavaScript.
     *
     * Encoding the JSON text a second time yields a correctly escaped literal. U+2028/U+2029 are
     * legal inside JSON strings but not inside JS string literals, so they are escaped explicitly.
     */
    fun postMessageScript(json: String): String {
        val literal = mapper.writeValueAsString(json)
            .replace("\u2028", "\\u2028")
            .replace("\u2029", "\\u2029")
        return "window.postMessage(JSON.parse($literal), 'https://$DOMAIN')"
    }
}
