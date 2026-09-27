package com.github.dineug.erdeditorintellijplugin.hub.document

import com.fasterxml.jackson.databind.node.ArrayNode

/** A local file an ERD editor shows; identity-stable through renames (VirtualFile in production). */
interface DocumentFile {
    /** Native separators, e.g. VirtualFile.toNioPath().toString(). */
    val localPath: String
    val isWritable: Boolean
    val isValid: Boolean
}

/**
 * One ErdEditor (one JCEF page). Every method is non-blocking except writeNow; all enqueue on the
 * page's one script channel, so the page receives them in call order.
 */
interface HubView {
    /** webviewInitialValueCommand; called once per page load, from the registry step that readies the view. */
    fun sendInitialValue(value: String)

    /** webviewReplicationCommand into this page. */
    fun inject(actions: ArrayNode)

    /** webviewUpdateReadonlyCommand; a no-op before the page exists. */
    fun pushReadonly(readonly: Boolean)

    /**
     * Writes latest() through this editor now (EDT write action, bounded), latest() read inside
     * the write action, so no older bytes land over a save made meanwhile; true when the file
     * then holds that value.
     */
    suspend fun writeNow(latest: () -> String): Boolean
}

/** What the document side needs from the IDE; production is agents/IntelliJIdeFacade. */
interface IdeFacade {
    /** The editor that could not open a file, as refusals name it: the full product name. */
    val editorName: String

    /**
     * Opens path in an ERD editor without focus. known is the registered file on that path, if
     * any, so a file first opened through a symlink is selected rather than opened twice.
     * Throws OpenRefused(reason) or any other throwable.
     */
    suspend fun openInEditor(path: String, known: DocumentFile?)

    /** Local paths of every ERD file under the open projects' content, node_modules skipped; on io. */
    suspend fun listErdFiles(): List<String>

    /** Every open project now, with its real folders and trust, read on io. */
    suspend fun trustedProjects(): List<ProjectTrust>
}

/** The IDE declined to open a file in an ERD editor; the message is the reason a refusal names. */
class OpenRefused(reason: String) : Exception(reason)
