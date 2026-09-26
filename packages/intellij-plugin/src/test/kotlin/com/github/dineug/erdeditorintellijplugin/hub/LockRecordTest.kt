package com.github.dineug.erdeditorintellijplugin.hub

import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The lock file's exact bytes and how strictly it reads back. Every reader parses JSON, but equal
 * records must write equal bytes, and a lock the MCP server's parseLock refuses leaves its window
 * invisible to agents, so both directions follow packages/agent-hub's lock.ts.
 */
class LockRecordTest {
    private val lock = Corpus.wire.lock

    @Test
    fun `writes the corpus bytes`() {
        for (case in lock.serialize) {
            assertEquals(case.text, serializeLock(case.record))
        }
    }

    @Test
    fun `reads back what it writes`() {
        for (case in lock.serialize) {
            assertEquals(case.record, parseLock(case.text))
        }
        val escaped = LockRecord(
            pipe = "/p",
            workspaceFolders = listOf("/홈/작업", "C:\\Users\\me"),
            documents = listOf("/a \"b\"\n c", "/x\u0001\t\u2028y"),
            ide = "intellij", version = "0.0.0-test", protocolVersion = 1, token = "t", hub = true,
        )
        assertEquals(escaped, parseLock(serializeLock(escaped)))
    }

    @Test
    fun `writes an empty array on one line`() {
        val record = LockRecord("", emptyList(), emptyList(), "intellij", "0.0.0-test", 1, "", false)
        assertEquals(
            "{\n  \"pipe\": \"\",\n  \"workspaceFolders\": [],\n  \"documents\": [],\n  \"ide\": \"intellij\",\n" +
                "  \"version\": \"0.0.0-test\",\n  \"protocolVersion\": 1,\n  \"token\": \"\",\n  \"hub\": false\n}\n",
            serializeLock(record),
        )
    }

    @Test
    fun `refuses a lock that is not JSON, not an object or ill-typed`() {
        for (raw in lock.parseNull) assertNull(HubJson.quote(raw), parseLock(raw))
    }

    @Test
    fun `drops unknown keys and takes a safe integer written 1 dot 0`() {
        for (case in lock.parseOk) assertEquals(case.raw, case.record, parseLock(case.raw))
    }
}
