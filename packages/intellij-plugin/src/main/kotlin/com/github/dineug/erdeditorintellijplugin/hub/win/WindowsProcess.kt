package com.github.dineug.erdeditorintellijplugin.hub.win

import com.github.dineug.erdeditorintellijplugin.hub.ProcessQuery
import com.sun.jna.Native
import com.sun.jna.platform.win32.Kernel32
import com.sun.jna.platform.win32.WinBase
import com.sun.jna.platform.win32.WinError
import com.sun.jna.platform.win32.WinNT
import com.sun.jna.ptr.IntByReference

/**
 * Windows liveness, the question libuv's uv_os_getpriority asks for the TypeScript hubs: open the
 * pid for PROCESS_QUERY_LIMITED_INFORMATION alone, which Windows grants this user on its every
 * process at any integrity level, then read the exit code. Never ProcessHandle, which also asks for
 * 0x40 (PROCESS_DUP_HANDLE) and so finds nothing where an unelevated IDE looks at an elevated window.
 * The platform's Kernel32, as NamedPipeTransport's, so nothing new stays in JNA's option maps.
 */
internal object WindowsProcess {
    fun query(pid: Int): ProcessQuery {
        val kernel32 = Kernel32.INSTANCE
        val handle = kernel32.OpenProcess(WinNT.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
            ?: return when (val error = Native.getLastError()) {
                WinError.ERROR_INVALID_PARAMETER -> ProcessQuery.NoSuchProcess
                WinError.ERROR_ACCESS_DENIED -> ProcessQuery.Denied
                else -> ProcessQuery.Failed(error)
            }
        try {
            val code = IntByReference()
            if (!kernel32.GetExitCodeProcess(handle, code)) return ProcessQuery.Failed(Native.getLastError())
            return if (code.value == WinBase.STILL_ACTIVE) ProcessQuery.Running else ProcessQuery.Exited
        } finally {
            kernel32.CloseHandle(handle)
        }
    }
}
