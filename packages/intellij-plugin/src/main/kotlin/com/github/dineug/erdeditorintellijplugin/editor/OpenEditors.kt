package com.github.dineug.erdeditorintellijplugin.editor

import java.util.concurrent.ConcurrentHashMap

/**
 * The ERD editors open on each file, and the runtime value their pages last saved, which a page the
 * hub's registry does not seed starts from. Kept in memory only, never written. Safe from any thread:
 * editors open and close on the EDT while pages save and relay from their bridge consumers.
 */
class OpenEditors<F : Any, E : Any> {
    private class Pages<E : Any> {
        val editors: MutableSet<E> = ConcurrentHashMap.newKeySet()

        @Volatile
        var runtimeValue: String? = null
    }

    private val files = ConcurrentHashMap<F, Pages<E>>()

    fun open(file: F, editor: E) {
        files.compute(file) { _, pages -> (pages ?: Pages()).also { it.editors += editor } }
    }

    /** The file's last editor takes the runtime value with it, so an editor opened later reads the file. */
    fun close(file: F, editor: E) {
        files.computeIfPresent(file) { _, pages ->
            pages.editors -= editor
            pages.takeIf { it.editors.isNotEmpty() }
        }
    }

    /** A snapshot, so a relay meets no editor opening or closing meanwhile. */
    fun editors(file: F): List<E> = files[file]?.editors?.toList().orEmpty()

    /**
     * A page of editor saved. A save with no runtime value, from an older bundle, keeps the last one,
     * and one from an editor no longer open on the file lands where no later editor of it reads.
     */
    fun saved(file: F, editor: E, runtimeValue: String?) {
        if (runtimeValue == null) return
        val pages = files[file] ?: return
        if (editor in pages.editors) pages.runtimeValue = runtimeValue
    }

    /** A page's initial value, never a write: the runtime value the file's editors hold, else the file's text. */
    fun seed(file: F, diskValue: String): String = files[file]?.runtimeValue ?: diskValue
}
