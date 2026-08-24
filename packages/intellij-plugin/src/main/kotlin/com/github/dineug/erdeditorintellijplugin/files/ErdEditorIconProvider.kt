package com.github.dineug.erdeditorintellijplugin.files

import com.intellij.ide.IconProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import javax.swing.Icon

class ErdEditorIconProvider : DumbAware, IconProvider()  {
    override fun getIcon(element: PsiElement, flags: Int): Icon? {
        if (element is PsiFile) {
            if (ErdEditorFiles.isErdEditorFile(element.virtualFile)) {
                return ErdEditorIcons.ErdEditorFileIcon
            }
        }
        return null
    }
}