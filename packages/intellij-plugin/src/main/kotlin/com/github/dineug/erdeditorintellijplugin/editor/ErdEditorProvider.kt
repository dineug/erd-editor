package com.github.dineug.erdeditorintellijplugin.editor

import com.github.dineug.erdeditorintellijplugin.files.ErdEditorFiles
import com.intellij.openapi.fileEditor.AsyncFileEditorProvider
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorPolicy
import com.intellij.openapi.fileEditor.impl.NonProjectFileWritingAccessProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap

class ErdEditorProvider : AsyncFileEditorProvider, DumbAware {
    // Application-scoped and touched from both the EDT (open/close) and background dispatchers
    // (replication broadcast), so it has to be concurrent.
    private val docToEditorsMap: ConcurrentMap<VirtualFile, MutableSet<ErdEditor>> = ConcurrentHashMap()

    override fun accept(project: Project, file: VirtualFile): Boolean = ErdEditorFiles.isErdEditorFile(file)
    override fun createEditor(project: Project, file: VirtualFile): FileEditor = createEditorAsync(project, file).build()
    override fun getEditorTypeId() = "erd-editor-jcef"
    override fun getPolicy() = FileEditorPolicy.HIDE_DEFAULT_EDITOR
    override fun createEditorAsync(project: Project, file: VirtualFile): AsyncFileEditorProvider.Builder =
            object : AsyncFileEditorProvider.Builder() {
                override fun build(): FileEditor {
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
}