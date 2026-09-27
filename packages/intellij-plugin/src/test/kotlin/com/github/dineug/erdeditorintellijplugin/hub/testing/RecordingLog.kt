package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import java.util.concurrent.CopyOnWriteArrayList

/** A HubLog that keeps every line, in order, from whichever hub thread wrote it. */
class RecordingLog : HubLog {
    private val recorded = CopyOnWriteArrayList<Pair<String, Any?>>()

    /** Every text with its detail, the prefix left out, as the corpus spells them. */
    val lines: List<Pair<String, Any?>> get() = recorded.toList()

    val texts: List<String> get() = recorded.map { it.first }

    override fun warn(text: String, detail: Any?) {
        recorded += text to detail
    }

    fun clear() {
        recorded.clear()
    }
}
