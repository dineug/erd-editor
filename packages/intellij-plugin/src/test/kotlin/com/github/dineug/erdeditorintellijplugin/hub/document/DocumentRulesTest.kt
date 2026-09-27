package com.github.dineug.erdeditorintellijplugin.hub.document

import com.github.dineug.erdeditorintellijplugin.files.ErdEditorFiles
import com.github.dineug.erdeditorintellijplugin.hub.HubErrorCode
import com.github.dineug.erdeditorintellijplugin.hub.HubRequestError
import com.github.dineug.erdeditorintellijplugin.hub.HubTimings
import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The files the hub serves and every text it refuses with: the texts every host shares from the
 * corpus of packages/agent-hub-host, and the IDE's own words (Q12, Q2) pinned here literally.
 */
class DocumentRulesTest {
    private val corpus = Corpus.host.documentRules

    private val refusals: Map<String, (List<String>) -> HubRequestError> = mapOf(
        "fileMissing" to { args -> DocumentRules.fileMissing(args[0]) },
        "folderMissing" to { args -> DocumentRules.folderMissing(args[0]) },
        "createNeedsInitialValue" to { _ -> DocumentRules.createNeedsInitialValue() },
        "editorCouldNotOpen" to { args -> DocumentRules.editorCouldNotOpen(args[0], args[1], args[2]) },
        "openTimedOut" to { args -> DocumentRules.openTimedOut(args[0]) },
        "notReadyForActions" to { args -> DocumentRules.notReadyForActions(args[0]) },
        "notJoined" to { args -> DocumentRules.notJoined(args[0]) },
        "notOpenInEditor" to { args -> DocumentRules.notOpenInEditor(args[0]) },
        "closedBeforeSave" to { args -> DocumentRules.closedBeforeSave(args[0]) },
        "closedDuringJoin" to { args -> DocumentRules.closedDuringJoin(args[0]) },
    )

    @Test
    fun `holds the extensions and the two waits, which the plugin's file matching and timings share`() {
        assertEquals(corpus.extensions, DocumentRules.ERD_FILE_EXTENSIONS)
        assertEquals(DocumentRules.ERD_FILE_EXTENSIONS, ErdEditorFiles.EXTENSIONS)
        assertEquals(corpus.openReadyTimeoutMs, DocumentRules.OPEN_READY_TIMEOUT_MS.toLong())
        assertEquals(corpus.saveQuietCapMs, DocumentRules.SAVE_QUIET_CAP_MS.toLong())
        assertEquals(corpus.openReadyTimeoutMs, HubTimings().openReadyTimeoutMs)
        assertEquals(corpus.saveQuietCapMs, HubTimings().saveQuietCapMs)
    }

    @Test
    fun `refuses every path the ERD editor does not own, whatever the letter case of the rest`() {
        for (case in corpus.erdFile) {
            assertEquals(case.path, case.problem, DocumentRules.erdFileProblem(case.path))
            val problem = case.problem
            if (problem == null) {
                DocumentRules.assertErdFile(case.path)
            } else {
                val refusal = assertRefusal(HubErrorCode.BAD_REQUEST) { DocumentRules.assertErdFile(case.path) }
                assertEquals(problem, refusal.message)
            }
        }
    }

    @Test
    fun `words every shared refusal and log line as the corpus does`() {
        assertEquals(refusals.keys, corpus.refusals.map { it.name }.toSet())
        for (case in corpus.refusals) {
            val refusal = refusals.getValue(case.name)(case.args)
            assertEquals(case.name, case.code, refusal.code.wire)
            assertEquals(case.name, case.message, refusal.message)
        }
        for (case in corpus.logs) {
            assertEquals("unsettledSave", case.name)
            assertEquals(case.text, DocumentRules.unsettledSave(case.args[0]))
        }
    }

    @Test
    fun `strips one leading byte order mark and nothing else`() {
        for (case in corpus.stripBom) {
            assertEquals(case.output, DocumentRules.stripBom(case.input))
        }
    }

    @Test
    fun `words the refusals and log lines only the IDE has`() {
        val path = "/ws/a.erd"
        assertRefusal(
            HubErrorCode.READONLY,
            "/ws/a.erd is open only as a read-only file, since the IDE cannot write it; " +
                "make it writable, then call again",
        ) { throw DocumentRules.readonlyFile(path) }
        assertRefusal(
            HubErrorCode.READONLY,
            "/ws/a.erd is open only as a read-only file, since the IDE cannot write it, and cannot be saved",
        ) { throw DocumentRules.readonlyFileSave(path) }
        assertRefusal(
            HubErrorCode.HUB_DISABLED,
            "/ws/a.erd is in a project this IDE does not trust, so the ERD Editor hub will not change it; " +
                "trust the project in the IDE, then call again",
        ) { throw DocumentRules.untrustedProject(path) }
        assertEquals("/ws/a.erd is still unsaved after its editor saved it", DocumentRules.stillUnsaved(path))
        assertEquals("saving /ws/a.erd failed", DocumentRules.saveFailed(path))
        assertEquals("could not write /ws/a.erd within 10000 ms", DocumentRules.saveWriteTimedOut(path))
        assertEquals(
            "IntelliJ IDEA could not open /ws/a.erd in the ERD editor: the ERD Editor plugin is turning off",
            DocumentRules.editorCouldNotOpen("IntelliJ IDEA", path, DocumentRules.REASON_TURNING_OFF).message,
        )
        assertEquals("JCEF is not supported in this IDE", DocumentRules.REASON_NO_JCEF)
        assertEquals("no project is open in this IDE", DocumentRules.REASON_NO_PROJECT)
        assertEquals("the IDE cannot find the file", DocumentRules.REASON_NO_VIRTUAL_FILE)
        assertEquals(10_000L, HubTimings().saveWriteBoundMs)
    }
}
