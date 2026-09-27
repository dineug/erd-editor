package com.github.dineug.erdeditorintellijplugin.agents

import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentFile
import com.intellij.openapi.vfs.VirtualFile

/**
 * A local file an ERD editor shows, as the hub's registry keeps it. The VFS keeps one VirtualFile per
 * file through renames and moves, so two editors of one file are the same document, whatever it is called.
 */
class VirtualFileDocument(val file: VirtualFile) : DocumentFile {
    override val localPath: String get() = file.toNioPath().toString()
    override val isWritable: Boolean get() = file.isWritable
    override val isValid: Boolean get() = file.isValid

    override fun equals(other: Any?): Boolean = other is VirtualFileDocument && other.file == file

    override fun hashCode(): Int = file.hashCode()

    override fun toString(): String = "VirtualFileDocument(${file.path})"
}
