package com.github.dineug.erdeditorintellijplugin.hub

import com.fasterxml.jackson.databind.JsonNode
import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * JSON lines as packages/agent-hub's framing.ts reads and writes them: split only at a newline,
 * blank lines skipped by JavaScript's trim, an unterminated tail dropped, the 64 MiB bound checked
 * in UTF-8 bytes before a line is buffered, and any line JSON.parse refuses fatal to the stream.
 */
class FramingTest {

    private fun FrameDecoder.feedText(text: String): List<String> =
        feed(text.toByteArray(Charsets.UTF_8)).map(HubJson::stringify)

    private fun texts(values: List<JsonNode>) = values.map(HubJson::stringify)

    @Test
    fun `encodes compact frames of raw UTF-8`() {
        val spaced = "{ \"id\": 1, \"method\": \"hello\", \"params\": { \"a\": [1, 2] } }"
        assertEquals("7b2261223a317d0a", encodeFrame("{\"a\":1}").toHex())
        assertEquals(
            "{\"id\":1,\"method\":\"hello\",\"params\":{\"a\":[1,2]}}\n",
            String(encodeFrame(HubJson.stringify(HubJson.parse(spaced))), Charsets.UTF_8),
        )
        assertEquals("22eab080220a", encodeFrame(HubJson.quote("가")).toHex())
        // Newlines inside strings are escaped, so the frame holds exactly one, at its end.
        val frame = encodeFrame(HubJson.stringify(HubJson.nodes.objectNode().put("text", "a\nb\r\nc")))
        assertEquals(1, frame.count { it == '\n'.code.toByte() })
    }

    @Test
    fun `encodes the corpus values`() {
        for (case in Corpus.wire.framing.encode) {
            assertEquals(case.hex, encodeFrame(HubJson.stringify(case.value)).toHex())
        }
    }

    @Test
    fun `decodes the corpus chunk streams`() {
        for (case in Corpus.wire.framing.chunks) {
            val decoder = FrameDecoder()
            val values = mutableListOf<String>()
            var failure: FrameException? = null
            for (chunk in case.chunks) {
                try {
                    values += decoder.feedText(chunk)
                } catch (e: FrameException) {
                    failure = e
                    break
                }
            }
            decoder.end()
            val name = case.chunks.toString()
            assertEquals(name, texts(case.values), values)
            val error = case.error
            if (error == null) {
                assertEquals(name, null, failure)
            } else {
                val reason =
                    if (error.reason == "notJson") FrameException.Reason.NOT_JSON else FrameException.Reason.TOO_LARGE
                assertEquals(name, reason, failure!!.reason)
                assertTrue(name, failure.message!!.startsWith(error.messagePrefix))
            }
        }
    }

    @Test
    fun `keeps a character split across two reads`() {
        val split = Corpus.wire.framing.splitUtf8
        val bytes = hexBytes(split.hex)
        val decoder = FrameDecoder()
        assertEquals(emptyList<JsonNode>(), decoder.feed(bytes, 0, split.splitAfter))
        val rest = decoder.feed(bytes, split.splitAfter, bytes.size - split.splitAfter)
        assertEquals(listOf(HubJson.stringify(split.value)), texts(rest))
    }

    @Test
    fun `skips lines JavaScript trims to nothing`() {
        for (case in Corpus.wire.framing.blank) {
            assertEquals(HubJson.quote(case.line), case.blank, isJsBlank(case.line))
        }
        assertTrue(isJsBlank("\u2000\u2005\u200A"))
    }

    @Test
    fun `delivers frames in order however the chunks fall`() {
        val decoder = FrameDecoder()
        assertEquals(listOf("{\"id\":1}", "{\"id\":2}"), decoder.feedText("{\"id\":1}\n{\"id\":2}\n"))
        assertEquals(emptyList<String>(), decoder.feedText("{\"met"))
        assertEquals(emptyList<String>(), decoder.feedText("hod\":\"actions\","))
        assertEquals(listOf("{\"method\":\"actions\",\"n\":1}"), decoder.feedText("\"n\":1}\n"))
        assertEquals(emptyList<String>(), decoder.feedText("\n"))
        assertEquals(listOf("{\"a\":1}", "{\"b\":2}"), decoder.feedText("\n  \n{\"a\":1}\r\n\t\n{\"b\":2}\r\r\n"))
    }

    @Test
    fun `reads a window of the buffer it is handed`() {
        val bytes = "xx{\"a\":1}\nyy".toByteArray(Charsets.UTF_8)
        assertEquals(listOf("{\"a\":1}"), texts(FrameDecoder().feed(bytes, 2, 8)))
        assertThrows(IndexOutOfBoundsException::class.java) { FrameDecoder().feed(bytes, 8, 8) }
    }

    @Test
    fun `drops an unterminated tail at the end of the stream`() {
        val decoder = FrameDecoder()
        assertEquals(listOf("{\"a\":1}"), decoder.feedText("{\"a\":1}\n{\"b\":"))
        decoder.end()
        assertEquals(listOf("{\"c\":3}"), decoder.feedText("{\"c\":3}\n"))
    }

    @Test
    fun `fails the stream on a line that is not JSON, with no value of its chunk and nothing after`() {
        val decoder = FrameDecoder()
        assertEquals(listOf("{\"a\":0}"), decoder.feedText("{\"a\":0}\n"))
        // {"a":1} completes in the failing chunk and is dropped with it; the TypeScript hub serves none of it.
        val failure = assertThrows(FrameException::class.java) { decoder.feedText("{\"a\":1}\n{\"a\":\n{\"b\":2}\n") }
        assertEquals(FrameException.Reason.NOT_JSON, failure.reason)
        assertTrue(failure.message!!.startsWith("A frame is not JSON: "))
        assertThrows(IllegalStateException::class.java) { decoder.feedText("{\"c\":3}\n") }
    }

    @Test
    fun `refuses a byte order mark before a frame`() {
        val decoder = FrameDecoder()
        assertEquals(emptyList<String>(), decoder.feedText("\uFEFF\n"))
        val failure = assertThrows(FrameException::class.java) { decoder.feedText("\uFEFF{\"id\":1}\n") }
        assertEquals(FrameException.Reason.NOT_JSON, failure.reason)
    }

    @Test
    fun `checks the size in UTF-8 bytes before the newline arrives`() {
        assertEquals(listOf("\"가가가가\""), FrameDecoder(maxBytes = 14).feedText("\"가가가가\"\n"))
        val korean = assertThrows(FrameException::class.java) {
            FrameDecoder(maxBytes = 13).feedText("\"가가가가\"\n")
        }
        assertEquals("A frame of 14 bytes exceeds the 13 byte limit", korean.message)

        val decoder = FrameDecoder(maxBytes = 16)
        assertEquals(emptyList<String>(), decoder.feedText("\"0123456789"))
        val early = assertThrows(FrameException::class.java) { decoder.feedText("abcdef") }
        assertEquals(FrameException.Reason.TOO_LARGE, early.reason)
        assertEquals("A frame of 17 bytes exceeds the 16 byte limit", early.message)
        assertThrows(IllegalStateException::class.java) { decoder.feedText("\n") }

        val pending = FrameDecoder(maxBytes = 16)
        assertEquals(emptyList<String>(), pending.feedText("\"0123456789abcd"))
        assertEquals(listOf("\"0123456789abcd\""), pending.feedText("\"\n"))
        assertThrows(FrameException::class.java) { pending.feedText("\"0123456789abcd\"x\n") }

        // A line and a tail too large in one chunk: the splitter fails before any line is parsed.
        val mixed = assertThrows(FrameException::class.java) { FrameDecoder(maxBytes = 8).feedText("nope\n0123456789") }
        assertEquals(FrameException.Reason.TOO_LARGE, mixed.reason)
    }

    @Test
    fun `takes a frame of exactly 64 MiB and refuses one byte more`() {
        // Spaces after the value keep the parse cheap: JSON.parse takes trailing whitespace.
        val exact = ByteArray(MAX_FRAME_BYTES) { ' '.code.toByte() }
        exact[0] = '{'.code.toByte()
        exact[1] = '}'.code.toByte()
        val decoder = FrameDecoder()
        var offset = 0
        while (offset < exact.size) {
            val length = minOf(64 * 1024, exact.size - offset)
            assertEquals(emptyList<JsonNode>(), decoder.feed(exact, offset, length))
            offset += length
        }
        assertEquals(listOf("{}"), texts(decoder.feed(byteArrayOf('\n'.code.toByte()))))
        assertEquals(listOf("1"), decoder.feedText("1\n"))

        val half = ByteArray(MAX_FRAME_BYTES / 2) { 'a'.code.toByte() }
        val halves = FrameDecoder()
        halves.feed(half)
        halves.feed(half)
        val overTail = assertThrows(FrameException::class.java) { halves.feed(byteArrayOf('a'.code.toByte())) }
        assertEquals("A frame of 67108865 bytes exceeds the 67108864 byte limit", overTail.message)

        val whole = FrameDecoder()
        whole.feed(exact)
        val overLine = assertThrows(FrameException::class.java) { whole.feedText("a\n") }
        assertEquals("A frame of 67108865 bytes exceeds the 67108864 byte limit", overLine.message)
    }

    @Test
    fun `encodes a frame of exactly 64 MiB and refuses one byte more`() {
        val json = "{}" + " ".repeat(MAX_FRAME_BYTES - 2)
        val frame = encodeFrame(json)
        assertEquals(MAX_FRAME_BYTES + 1, frame.size)
        assertEquals('\n'.code.toByte(), frame.last())

        val over = assertThrows(FrameTooLargeException::class.java) { encodeFrame("$json ") }
        assertEquals(MAX_FRAME_BYTES + 1L, over.bytes)
        assertEquals("A frame of 67108865 bytes exceeds the 67108864 byte limit", over.message)

        assertArrayEquals("\"가\"\n".toByteArray(Charsets.UTF_8), encodeFrame("\"가\"", maxBytes = 5))
        val small = assertThrows(FrameTooLargeException::class.java) { encodeFrame("\"가\"", maxBytes = 4) }
        assertEquals("A frame of 5 bytes exceeds the 4 byte limit", small.message)
    }

    @Test
    fun `releases the buffer a large frame grew`() {
        val decoder = FrameDecoder()
        val big = "\"" + "x".repeat(300_000) + "\""
        assertEquals(emptyList<String>(), decoder.feedText(big.substring(0, 100)))
        assertEquals(listOf(big), decoder.feedText(big.substring(100) + "\n"))
        assertEquals(listOf("2"), decoder.feedText("2\n"))
    }
}
