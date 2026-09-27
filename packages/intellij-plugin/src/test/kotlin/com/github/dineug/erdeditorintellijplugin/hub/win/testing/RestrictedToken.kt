package com.github.dineug.erdeditorintellijplugin.hub.win.testing

import com.sun.jna.Memory
import com.sun.jna.Native
import com.sun.jna.NativeLibrary
import com.sun.jna.platform.win32.Advapi32
import com.sun.jna.platform.win32.Advapi32Util
import com.sun.jna.platform.win32.Kernel32
import com.sun.jna.platform.win32.WinNT
import com.sun.jna.ptr.IntByReference

/** A mandatory label a test token takes, by its SID. */
enum class Integrity(val sid: String) {
    LOW("S-1-16-4096"),
    MEDIUM("S-1-16-8192"),
}

/**
 * Windows only: a copy of this process's token impersonated on the calling thread, so what the thread
 * opens is checked against it. DISABLE_MAX_PRIVILEGE drops every privilege, so no SeDebugPrivilege of
 * an administrator's runner opens what the groups may not; Administrators deny-only when asked, as in
 * an administrator's unelevated token; then the given label. JNA Functions where jna-platform binds none.
 */
object RestrictedToken {
    private const val ADMINISTRATORS = "S-1-5-32-544"
    private const val DISABLE_MAX_PRIVILEGE = 0x1
    private const val SE_GROUP_INTEGRITY = 0x20
    private const val LABEL_BYTES = 256L

    private val advapi32Functions by lazy { NativeLibrary.getInstance("advapi32") }

    /** Runs block impersonating the restricted token, and reverts to this process's own in any case. */
    fun <T> impersonate(integrity: Integrity, denyAdministrators: Boolean, block: () -> T): T {
        val advapi32 = Advapi32.INSTANCE
        val own = WinNT.HANDLEByReference()
        val restricted = WinNT.HANDLEByReference()
        val impersonation = WinNT.HANDLEByReference()
        try {
            succeeded(advapi32.OpenProcessToken(currentProcess(), WinNT.TOKEN_ALL_ACCESS, own), "OpenProcessToken")
            val disabled = if (denyAdministrators) sidAndAttributes(ADMINISTRATORS, 0) else null
            val made = advapi32Functions.getFunction("CreateRestrictedToken").invokeInt(
                arrayOf(own.value, DISABLE_MAX_PRIVILEGE, if (disabled == null) 0 else 1, disabled, 0, null, 0, null, restricted),
            )
            succeeded(made != 0, "CreateRestrictedToken")
            val duplicated = advapi32.DuplicateTokenEx(
                restricted.value, WinNT.TOKEN_ALL_ACCESS, null,
                WinNT.SECURITY_IMPERSONATION_LEVEL.SecurityImpersonation, WinNT.TOKEN_TYPE.TokenImpersonation,
                impersonation,
            )
            succeeded(duplicated, "DuplicateTokenEx")
            // TOKEN_MANDATORY_LABEL, its length counting the SID it points to.
            val label = sidAndAttributes(integrity.sid, SE_GROUP_INTEGRITY)
            val labelled = advapi32Functions.getFunction("SetTokenInformation").invokeInt(
                arrayOf(impersonation.value, WinNT.TOKEN_INFORMATION_CLASS.TokenIntegrityLevel, label, label.size().toInt()),
            )
            succeeded(labelled != 0, "SetTokenInformation")
            succeeded(advapi32.SetThreadToken(null, impersonation.value), "SetThreadToken")
            try {
                return block()
            } finally {
                succeeded(advapi32.RevertToSelf(), "RevertToSelf")
            }
        } finally {
            listOf(impersonation, restricted, own).forEach { handle -> handle.value?.let(Kernel32.INSTANCE::CloseHandle) }
        }
    }

    /** The RID of this process's own label: 0x2000 at Medium, 0x3000 at High, where it runs elevated. */
    fun processIntegrityLevel(): Int {
        val own = WinNT.HANDLEByReference()
        succeeded(Advapi32.INSTANCE.OpenProcessToken(currentProcess(), WinNT.TOKEN_QUERY, own), "OpenProcessToken")
        try {
            val label = Memory(LABEL_BYTES)
            val read = advapi32Functions.getFunction("GetTokenInformation").invokeInt(
                arrayOf(own.value, WinNT.TOKEN_INFORMATION_CLASS.TokenIntegrityLevel, label, LABEL_BYTES.toInt(), IntByReference()),
            )
            succeeded(read != 0, "GetTokenInformation")
            return Advapi32Util.convertSidToStringSid(WinNT.PSID(label.getPointer(0))).substringAfterLast('-').toInt()
        } finally {
            Kernel32.INSTANCE.CloseHandle(own.value)
        }
    }

    private fun currentProcess(): WinNT.HANDLE = Kernel32.INSTANCE.GetCurrentProcess()

    /** One SID_AND_ATTRIBUTES with the SID's bytes after it, in one block the call keeps alive. */
    private fun sidAndAttributes(sid: String, attributes: Int): Memory {
        val bytes = Advapi32Util.convertStringSidToSid(sid)
        val header = Native.POINTER_SIZE * 2L
        return Memory(header + bytes.size).apply {
            write(header, bytes, 0, bytes.size)
            setPointer(0, share(header))
            setInt(Native.POINTER_SIZE.toLong(), attributes)
        }
    }

    private fun succeeded(done: Boolean, call: String) {
        if (!done) throw IllegalStateException("$call failed with error ${Native.getLastError()}")
    }
}
