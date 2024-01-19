package com.github.dineug.erdeditorintellijplugin.editor

import com.intellij.openapi.fileEditor.AsyncFileEditorProvider
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorPolicy
import com.intellij.openapi.fileEditor.impl.NonProjectFileWritingAccessProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile

class ErdEditorProvider : AsyncFileEditorProvider, DumbAware {
    private val docToEditorsMap = HashMap<VirtualFile, HashSet<ErdEditor>>()

    override fun accept(project: Project, file: VirtualFile): Boolean {
        return when {
            file.isDirectory || !file.exists() -> false

            file.name.endsWith(".erd.json") -> true

            else -> false
        }
    }
    override fun createEditor(project: Project, file: VirtualFile): FileEditor = createEditorAsync(project, file).build()
    override fun getEditorTypeId() = "erd-editor-jcef"
    override fun getPolicy() = FileEditorPolicy.HIDE_DEFAULT_EDITOR
    override fun createEditorAsync(project: Project, file: VirtualFile): AsyncFileEditorProvider.Builder =
            object : AsyncFileEditorProvider.Builder() {
                override fun build(): FileEditor {
                    if (NonProjectFileWritingAccessProvider.isWriteAccessAllowed(file, project)) {
                        NonProjectFileWritingAccessProvider.allowWriting(listOf(file))
                    }

                    val editor = ErdEditor(project, file, docToEditorsMap)
                    docToEditorsMap.getOrPut(file) { HashSet() }.add(editor)
                    return editor
                }
            }
}