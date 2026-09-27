package com.github.dineug.erdeditorintellijplugin.agents

import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileSystem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.InputStream
import java.io.OutputStream
import java.nio.file.Path

/**
 * The registry keys documents by DocumentFile, so two editors of one VirtualFile must be one
 * document, and a rename must keep it; a stub VirtualFile keeps this a plain JVM test.
 */
class VirtualFileDocumentTest {
    private class StubVirtualFile(var nioPath: Path, var canWrite: Boolean = true, var alive: Boolean = true) : VirtualFile() {
        override fun toNioPath(): Path = nioPath
        override fun getName() = nioPath.fileName.toString()
        override fun isDirectory() = false
        override fun isValid() = alive
        override fun getFileSystem(): VirtualFileSystem = throw UnsupportedOperationException()
        override fun getPath() = nioPath.toString()
        override fun isWritable() = canWrite
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
    fun `reads the file's path, writability and validity each time`() {
        val file = StubVirtualFile(Path.of("/work/schema.erd"))
        val document = VirtualFileDocument(file)

        assertEquals(Path.of("/work/schema.erd").toString(), document.localPath)
        assertTrue(document.isWritable)
        assertTrue(document.isValid)

        file.nioPath = Path.of("/work/renamed.erd")
        file.canWrite = false
        file.alive = false

        assertEquals(Path.of("/work/renamed.erd").toString(), document.localPath)
        assertFalse(document.isWritable)
        assertFalse(document.isValid)
    }

    @Test
    fun `two documents of one file are the same document`() {
        val file = StubVirtualFile(Path.of("/work/schema.erd"))
        val first = VirtualFileDocument(file)
        val second = VirtualFileDocument(file)

        assertEquals(first, second)
        assertEquals(first.hashCode(), second.hashCode())
        assertEquals(1, hashMapOf(first to "a", second to "b").size)
    }

    @Test
    fun `documents of two files differ, even at one path`() {
        val path = Path.of("/work/schema.erd")

        assertNotEquals(VirtualFileDocument(StubVirtualFile(path)), VirtualFileDocument(StubVirtualFile(path)))
        assertNotEquals(VirtualFileDocument(StubVirtualFile(path)), "/work/schema.erd")
    }
}
