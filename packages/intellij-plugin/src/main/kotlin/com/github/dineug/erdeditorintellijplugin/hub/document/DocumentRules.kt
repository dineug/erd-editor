package com.github.dineug.erdeditorintellijplugin.hub.document

import com.github.dineug.erdeditorintellijplugin.hub.HubErrorCode
import com.github.dineug.erdeditorintellijplugin.hub.HubRequestError
import java.util.Locale

/**
 * The files the hub serves and the words it refuses with, as packages/agent-hub-host's
 * documentRules.ts: a situation every host meets answers the same text, pinned by the shared
 * corpus; a situation only the IDE has keeps its own words, pinned by DocumentRulesTest.
 */
object DocumentRules {
    /** The file extensions the ERD editor opens, and the only ones the hub serves; order matters for R1. */
    val ERD_FILE_EXTENSIONS: List<String> = listOf("erd", "vuerd", "erd.json", "vuerd.json")

    /** How long openDocument waits for the first editor to report ready. */
    const val OPEN_READY_TIMEOUT_MS = 5_000

    /** How long save waits for the replicas to hold every edit before it answers saved false. */
    const val SAVE_QUIET_CAP_MS = 2_000

    /** How long save waits for its write through the editor; the texts keep the production number. */
    private const val SAVE_WRITE_BOUND_MS = 10_000

    const val REASON_TURNING_OFF = "the ERD Editor plugin is turning off"

    /** Why the settings page says the hub cannot run: no ERD editor can exist without JCEF. */
    const val REASON_NO_JCEF = "JCEF is not supported in this IDE"
    const val REASON_NO_PROJECT = "no project is open in this IDE"
    const val REASON_NO_VIRTUAL_FILE = "the IDE cannot find the file"

    /** R1: the refusal text for a path the ERD editor does not own, or null for an ERD file. */
    fun erdFileProblem(path: String): String? {
        val name = path.lowercase(Locale.ROOT)
        if (ERD_FILE_EXTENSIONS.any { name.endsWith(".$it") }) return null
        return "$path is not an ERD file; the hub serves ${ERD_FILE_EXTENSIONS.joinToString(", ") { ".$it" }} only"
    }

    /** Throws R1 before anything opens, reads or writes a path that is no ERD file. */
    fun assertErdFile(path: String) {
        erdFileProblem(path)?.let { throw HubRequestError(HubErrorCode.BAD_REQUEST, it) }
    }

    /** The editors read a file without its byte order mark, so no peer is handed one either. */
    fun stripBom(text: String): String = if (text.startsWith('\uFEFF')) text.substring(1) else text

    /** R2: openDocument without create, or a join read from disk, found no file. */
    fun fileMissing(path: String): HubRequestError = refusal(HubErrorCode.NOT_FOUND, "$path does not exist")

    /** R3: openDocument with create found no folder to put the file in. */
    fun folderMissing(path: String): HubRequestError =
        refusal(HubErrorCode.NOT_FOUND, "The folder of $path does not exist")

    /** R4 */
    fun createNeedsInitialValue(): HubRequestError = refusal(
        HubErrorCode.BAD_REQUEST,
        "openDocument with create needs a string initialValue, the bytes of an empty document",
    )

    /** R5: editor is the IDE's full product name; reason a fixed REASON_ text or the failure. */
    fun editorCouldNotOpen(editor: String, path: String, reason: String): HubRequestError =
        refusal(HubErrorCode.NOT_OPEN, "$editor could not open $path in the ERD editor: $reason")

    /** R6 */
    fun openTimedOut(path: String): HubRequestError =
        refusal(HubErrorCode.NOT_OPEN, "No ERD editor on $path reported ready within $OPEN_READY_TIMEOUT_MS ms")

    /** R7: applyActions on a document no ready editor shows. */
    fun notReadyForActions(path: String): HubRequestError = refusal(
        HubErrorCode.NOT_OPEN,
        "$path is not open in an ERD editor that is ready; open it with openDocument, then join",
    )

    /** R8 */
    fun notJoined(path: String): HubRequestError =
        refusal(HubErrorCode.NOT_OPEN, "Join $path before applying actions to it")

    /** R9: save on a document no editor shows. */
    fun notOpenInEditor(path: String): HubRequestError =
        refusal(HubErrorCode.NOT_OPEN, "$path is not open in an ERD editor")

    /** R10: save waited for the replicas, and the document closed meanwhile. */
    fun closedBeforeSave(path: String): HubRequestError =
        refusal(HubErrorCode.NOT_OPEN, "$path closed before it could be saved")

    /** R11: join registered the peer, and the document closed or the peer left before the capture. */
    fun closedDuringJoin(path: String): HubRequestError =
        refusal(HubErrorCode.NOT_OPEN, "$path closed, or the peer left it, before the join finished")

    /** L1: what save logs when it answers saved false because the replicas never went quiet. */
    fun unsettledSave(path: String): String =
        "$path has an edit no replica saved within $SAVE_QUIET_CAP_MS ms; its bytes may lack it, so nothing was saved"

    /** applyActions or openDocument on a local file the IDE cannot write. */
    fun readonlyFile(path: String): HubRequestError = refusal(
        HubErrorCode.READONLY,
        "$path is open only as a read-only file, since the IDE cannot write it; make it writable, then call again",
    )

    fun readonlyFileSave(path: String): HubRequestError = refusal(
        HubErrorCode.READONLY,
        "$path is open only as a read-only file, since the IDE cannot write it, and cannot be saved",
    )

    /** One lock serves every project, so a path only untrusted projects hold is read but never changed. */
    fun untrustedProject(path: String): HubRequestError = refusal(
        HubErrorCode.HUB_DISABLED,
        "$path is in a project this IDE does not trust, so the ERD Editor hub will not change it; " +
            "trust the project in the IDE, then call again",
    )

    /** What save logs when the writer's write left the file without the value. */
    fun stillUnsaved(path: String): String = "$path is still unsaved after its editor saved it"

    /** What save logs, with the failure, when the writer's write threw. */
    fun saveFailed(path: String): String = "saving $path failed"

    /** What save logs when its write through the editor did not finish within the bound. */
    fun saveWriteTimedOut(path: String): String = "could not write $path within $SAVE_WRITE_BOUND_MS ms"

    private fun refusal(code: HubErrorCode, message: String) = HubRequestError(code, message)
}
