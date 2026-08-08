package com.github.dineug.erdeditorintellijplugin.editor

import com.github.dineug.erdeditorintellijplugin.files.ErdEditorFiles
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorPolicy
import com.intellij.openapi.fileEditor.FileEditorProvider
import com.intellij.openapi.fileEditor.impl.NonProjectFileWritingAccessProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap

/**
 * Implements the stable [FileEditorProvider] rather than `AsyncFileEditorProvider`.
 *
 * The async variant adds only a suspending `createFileEditor`, which is `@Experimental` and, being a
 * default method, is inherited - and reported by Plugin Verifier - without appearing in this file.
 * Nothing is given up by dropping it: its default body calls `createEditorAsync` off the EDT and
 * then runs the builder inside `withContext(Dispatchers.EDT)`, and everything below already had to
 * happen on the EDT anyway.
 */
class ErdEditorProvider : FileEditorProvider, DumbAware {
    // Application-scoped and touched from both the EDT (open/close) and background dispatchers
    // (replication broadcast), so it has to be concurrent.
    private val docToEditorsMap: ConcurrentMap<VirtualFile, MutableSet<ErdEditor>> = ConcurrentHashMap()

    override fun accept(project: Project, file: VirtualFile): Boolean = ErdEditorFiles.isErdEditorFile(file)
    override fun getEditorTypeId() = "erd-editor-jcef"
    override fun getPolicy() = FileEditorPolicy.HIDE_DEFAULT_EDITOR

    override fun createEditor(project: Project, file: VirtualFile): FileEditor {
        // Grant writing when the platform would otherwise deny it: isWriteAccessAllowed
        // returns false exactly for the non-project files that need unlocking, which is
        // how NonProjectFileWritingAccessProvider.requestWriting picks its denied set.
        if (!NonProjectFileWritingAccessProvider.isWriteAccessAllowed(file, project)) {
            NonProjectFileWritingAccessProvider.allowWriting(listOf(file))
        }

        val editor = ErdEditor(file, docToEditorsMap)
        docToEditorsMap.computeIfAbsent(file) { ConcurrentHashMap.newKeySet() }.add(editor)
        return editor
    }
}
