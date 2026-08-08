package com.github.dineug.erdeditorintellijplugin.files

import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileSystem
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.InputStream
import java.io.OutputStream

/**
 * The extension test decides which files the plugin takes over from the default editor, so it is
 * worth pinning. VirtualFile is an abstract class, so this uses a hand-written stub rather than a
 * dynamic proxy - which keeps the test a plain JVM test with no IDE fixture.
 */
class ErdEditorFilesTest {

    private class StubVirtualFile(
        private val name: String,
        private val directory: Boolean = false,
        private val valid: Boolean = true,
    ) : VirtualFile() {
        override fun getName() = name
        override fun isDirectory() = directory
        override fun isValid() = valid
        override fun getFileSystem(): VirtualFileSystem = throw UnsupportedOperationException()
        override fun getPath() = "/stub/$name"
        override fun isWritable() = true
        override fun getParent(): VirtualFile? = null
        override fun getChildren(): Array<VirtualFile> = emptyArray()
        override fun getOutputStream(requestor: Any?, newModificationStamp: Long, newTimeStamp: Long): OutputStream =
            throw UnsupportedOperationException()
        override fun contentsToByteArray(): ByteArray = ByteArray(0)
        override fun getTimeStamp() = 0L
        override fun getLength() = 0L
        override fun refresh(asynchronous: Boolean, recursive: Boolean, postRunnable: Runnable?) = Unit
        override fun getInputStream(): InputStream = throw UnsupportedOperationException()
    }

    @Test
    fun `accepts erd extensions`() {
        assertTrue(ErdEditorFiles.isErdEditorFile(StubVirtualFile("schema.erd")))
        assertTrue(ErdEditorFiles.isErdEditorFile(StubVirtualFile("schema.erd.json")))
    }

    @Test
    fun `rejects other files`() {
        assertFalse(ErdEditorFiles.isErdEditorFile(StubVirtualFile("schema.json")))
        assertFalse(ErdEditorFiles.isErdEditorFile(StubVirtualFile("erd")))
        assertFalse(ErdEditorFiles.isErdEditorFile(StubVirtualFile("Main.kt")))
    }

    @Test
    fun `rejects null, directories and missing files`() {
        assertFalse(ErdEditorFiles.isErdEditorFile(null))
        assertFalse(ErdEditorFiles.isErdEditorFile(StubVirtualFile("dir.erd", directory = true)))
        assertFalse(ErdEditorFiles.isErdEditorFile(StubVirtualFile("gone.erd", valid = false)))
    }
}
