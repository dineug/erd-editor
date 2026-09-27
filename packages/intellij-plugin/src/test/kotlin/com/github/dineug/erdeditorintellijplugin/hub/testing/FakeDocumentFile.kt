package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentFile

/**
 * A DocumentFile whose path and flags a test changes as the IDE would: a rename or move changes
 * localPath on the same instance, as a VirtualFile keeps its identity. Compared by identity.
 */
class FakeDocumentFile(
    @Volatile override var localPath: String,
    @Volatile override var isWritable: Boolean = true,
    @Volatile override var isValid: Boolean = true,
) : DocumentFile {
    override fun toString(): String = "FakeDocumentFile($localPath)"
}
