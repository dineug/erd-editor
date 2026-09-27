package com.github.dineug.erdeditorintellijplugin.agents

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.progress.ProcessCanceledException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import java.io.IOException
import java.util.concurrent.CancellationException

/**
 * What the hub's lines look like in idea.log: the shared prefix, a failure attached as such, and a
 * cancellation or control-flow exception only named, since Logger refuses to log one.
 */
class IdeHubLogTest {
    /** Keeps each line with its level and throwable; a warning logged as an error would fail here. */
    private class RecordingLogger : Logger() {
        val lines = ArrayList<Triple<String, String?, Throwable?>>()

        override fun isDebugEnabled() = false
        override fun debug(message: String?, t: Throwable?) = Unit
        override fun info(message: String?, t: Throwable?) {
            lines += Triple("info", message, t)
        }
        override fun warn(message: String?, t: Throwable?) {
            lines += Triple("warn", message, t)
        }
        override fun error(message: String?, t: Throwable?, vararg details: String?) {
            lines += Triple("error", message, t)
        }
    }

    private val logger = RecordingLogger()
    private val log = IdeHubLog(logger)

    @Test
    fun `writes a line with the hub's prefix`() {
        log.warn("could not listen on /tmp/x.sock")

        assertEquals(listOf(Triple("warn", "[erd-editor hub] could not listen on /tmp/x.sock", null)), logger.lines)
    }

    @Test
    fun `attaches a failure as its throwable`() {
        val failure = IOException("disk full")

        log.warn("request failed", failure)

        val (level, message, throwable) = logger.lines.single()
        assertEquals("warn", level)
        assertEquals("[erd-editor hub] request failed", message)
        assertSame(failure, throwable)
    }

    @Test
    fun `appends any other detail to the line`() {
        log.warn("liveness falls back", 42)

        assertEquals(listOf(Triple("warn", "[erd-editor hub] liveness falls back 42", null)), logger.lines)
    }

    @Test
    fun `names a cancellation or a control-flow exception without attaching it`() {
        log.warn("request failed", CancellationException("gone"))
        log.warn("request failed", ProcessCanceledException())

        assertEquals(
            listOf(
                Triple("warn", "[erd-editor hub] request failed java.util.concurrent.CancellationException", null),
                Triple(
                    "warn",
                    "[erd-editor hub] request failed com.intellij.openapi.progress.ProcessCanceledException",
                    null,
                ),
            ),
            logger.lines,
        )
    }

    @Test
    fun `writes why no hub runs as information`() {
        log.info("the document hub does not start: a headless IDE")

        val (level, message, throwable) = logger.lines.single()
        assertEquals("info", level)
        assertEquals("[erd-editor hub] the document hub does not start: a headless IDE", message)
        assertNull(throwable)
    }
}
