package com.github.dineug.erdeditorintellijplugin.files

import com.intellij.openapi.vfs.VirtualFile

class ErdEditorFiles {
    companion object {
        /** The extensions the ERD editor opens, whatever their letter case (`SCHEMA.ERD` too). */
        val EXTENSIONS = listOf("erd", "vuerd", "erd.json", "vuerd.json")

        fun isErdEditorFile(file: VirtualFile?): Boolean {
            return when {
                file == null -> false
                file.isDirectory || !file.exists() -> false

                else -> {
                    val name = file.name.lowercase()
                    EXTENSIONS.any { extension -> name.endsWith(".$extension") }
                }
            }
        }
    }
}
