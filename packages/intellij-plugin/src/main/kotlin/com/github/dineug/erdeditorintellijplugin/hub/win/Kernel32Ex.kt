package com.github.dineug.erdeditorintellijplugin.hub.win

import com.sun.jna.Native
import com.sun.jna.Pointer
import com.sun.jna.platform.win32.WinNT
import com.sun.jna.ptr.IntByReference
import com.sun.jna.win32.StdCallLibrary
import com.sun.jna.win32.W32APIOptions

/**
 * The calls jna-platform's Kernel32 lacks or declares with byte[]: overlapped pipe I/O takes a
 * Pointer to an OVERLAPPED the caller keeps alive, and GetFinalPathNameByHandle is not bound at all.
 * CreateFile, CreateNamedPipe, CreateEvent, SetEvent, WaitForMultipleObjects and CloseHandle come
 * from com.sun.jna.platform.win32.Kernel32.INSTANCE; errors from Native.getLastError().
 */
@Suppress("FunctionName")
internal interface Kernel32Ex : StdCallLibrary {
    fun ConnectNamedPipe(pipe: WinNT.HANDLE, overlapped: Pointer): Boolean

    fun ReadFile(file: WinNT.HANDLE, buffer: Pointer, toRead: Int, read: IntByReference?, overlapped: Pointer): Boolean

    fun WriteFile(
        file: WinNT.HANDLE, buffer: Pointer, toWrite: Int, written: IntByReference?, overlapped: Pointer,
    ): Boolean

    fun GetOverlappedResult(
        file: WinNT.HANDLE, overlapped: Pointer, transferred: IntByReference, wait: Boolean,
    ): Boolean

    fun CancelIoEx(file: WinNT.HANDLE, overlapped: Pointer?): Boolean

    /** Only the escape hatch of a flush that must not outlive its bound. */
    fun CancelSynchronousIo(thread: WinNT.HANDLE): Boolean

    /** GetFinalPathNameByHandleW, through the W suffix DEFAULT_OPTIONS' function mapper adds. */
    fun GetFinalPathNameByHandle(file: WinNT.HANDLE, path: CharArray, size: Int, flags: Int): Int

    companion object {
        const val FILE_FLAG_FIRST_PIPE_INSTANCE: Int = 0x00080000
        const val VOLUME_NAME_DOS: Int = 0

        /** Loaded on first use, which happens on Windows only. */
        val INSTANCE: Kernel32Ex by lazy {
            Native.load("kernel32", Kernel32Ex::class.java, W32APIOptions.DEFAULT_OPTIONS)
        }
    }
}
