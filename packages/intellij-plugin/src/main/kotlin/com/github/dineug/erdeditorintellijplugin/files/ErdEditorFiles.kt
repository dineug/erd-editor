package com.github.dineug.erdeditorintellijplugin.files

import com.intellij.openapi.vfs.VirtualFile

class ErdEditorFiles {
    companion object {
        fun isErdEditorFile(file: VirtualFile?): Boolean {
            return when {
                file == null -> false
                file.isDirectory || !file.exists() -> false

                arrayOf(".erd", ".erd.json").any { ext -> file.name.endsWith(ext) } -> true

                else -> false
            }
        }
    }
}