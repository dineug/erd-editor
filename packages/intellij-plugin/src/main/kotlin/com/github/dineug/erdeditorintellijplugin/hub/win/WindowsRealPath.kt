package com.github.dineug.erdeditorintellijplugin.hub.win

import com.github.dineug.erdeditorintellijplugin.hub.RealPathResult
import com.github.dineug.erdeditorintellijplugin.hub.rethrowIfCancellation
import com.sun.jna.Native
import com.sun.jna.platform.win32.Kernel32
import com.sun.jna.platform.win32.WinBase
import com.sun.jna.platform.win32.WinError
import com.sun.jna.platform.win32.WinNT
import java.io.IOException

/**
 * libuv's realpath on Windows, which Node's fs.promises.realpath and so the MCP server use: the
 * final path of an open handle, so a subst or mapped drive resolves to its target where the JDK's
 * toRealPath keeps the letter it was given. Only MachineEnvironment on WIN32 calls it.
 */
internal object WindowsRealPath {
    private const val UNC_PREFIX = "\\\\?\\UNC\\"
    private const val LONG_PREFIX = "\\\\?\\"
    private const val INITIAL_CHARS = 512

    /**
     * The errors libuv's uv_translate_sys_error turns into ENOENT that opening a path can give, so
     * "bad?name" (ERROR_INVALID_NAME) is missing here as to Node. The JDK's lstat calls only the first
     * two missing and refuses a "?" in a Path, so the climb stops there where Node's goes on.
     */
    private val NOT_FOUND_ERRORS = setOf(
        WinError.ERROR_FILE_NOT_FOUND,
        WinError.ERROR_PATH_NOT_FOUND,
        WinError.ERROR_BAD_PATHNAME,
        WinError.ERROR_DIRECTORY,
        WinError.ERROR_INVALID_NAME,
        WinError.ERROR_INVALID_DRIVE,
        WinError.ERROR_INVALID_REPARSE_DATA,
    )

    /**
     * CreateFileW(path, 0, FILE_SHARE_READ|WRITE|DELETE, null, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS),
     * GetFinalPathNameByHandleW(…, VOLUME_NAME_DOS), CloseHandle. An error in NOT_FOUND_ERRORS, libuv's
     * ENOENT, → NotFound; anything else → Other.
     */
    fun realPath(path: String): RealPathResult {
        // A NUL would end the wide string early and name another file; Node refuses such a string outright.
        if ('\u0000' in path) return RealPathResult.Other(IOException("$path holds a NUL character"))
        return try {
            resolve(path)
        } catch (e: Exception) {
            e.rethrowIfCancellation()
            RealPathResult.Other(e)
        } catch (e: LinkageError) {
            RealPathResult.Other(e)
        }
    }

    /** "\\?\UNC\server\share" → "\\server\share", "\\?\C:\x" → "C:\x"; null for any other shape, as in libuv. */
    fun stripFinalPathPrefix(finalPath: String): String? = when {
        finalPath.startsWith(UNC_PREFIX) -> "\\\\" + finalPath.substring(UNC_PREFIX.length)
        finalPath.startsWith(LONG_PREFIX) -> finalPath.substring(LONG_PREFIX.length)
        else -> null
    }

    private fun resolve(path: String): RealPathResult {
        val kernel32 = Kernel32.INSTANCE
        val handle = kernel32.CreateFile(
            path,
            0,
            WinNT.FILE_SHARE_READ or WinNT.FILE_SHARE_WRITE or WinNT.FILE_SHARE_DELETE,
            null,
            WinNT.OPEN_EXISTING,
            WinNT.FILE_FLAG_BACKUP_SEMANTICS,
            null,
        )
        if (handle == null || handle == WinBase.INVALID_HANDLE_VALUE) {
            val error = Native.getLastError()
            return if (error in NOT_FOUND_ERRORS) {
                RealPathResult.NotFound
            } else {
                RealPathResult.Other(IOException("CreateFileW failed on $path with error $error"))
            }
        }
        try {
            val finalPath = finalPathOf(handle)
                ?: return RealPathResult.Other(IOException("GetFinalPathNameByHandleW failed on $path"))
            val real = stripFinalPathPrefix(finalPath)
                ?: return RealPathResult.Other(IOException("$finalPath is not a path Node would resolve"))
            return RealPathResult.Ok(real)
        } finally {
            kernel32.CloseHandle(handle)
        }
    }

    /** The final path, the buffer grown once to the length the first call asked for; null on failure. */
    private fun finalPathOf(handle: WinNT.HANDLE): String? {
        val kernel32 = Kernel32Ex.INSTANCE
        var buffer = CharArray(INITIAL_CHARS)
        var length = kernel32.GetFinalPathNameByHandle(handle, buffer, buffer.size, Kernel32Ex.VOLUME_NAME_DOS)
        if (length > buffer.size) {
            buffer = CharArray(length)
            length = kernel32.GetFinalPathNameByHandle(handle, buffer, buffer.size, Kernel32Ex.VOLUME_NAME_DOS)
        }
        return if (length in 1..<buffer.size) String(buffer, 0, length) else null
    }
}
