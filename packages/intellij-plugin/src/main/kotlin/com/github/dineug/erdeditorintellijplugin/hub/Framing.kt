package com.github.dineug.erdeditorintellijplugin.hub

import com.fasterxml.jackson.databind.JsonNode
import java.util.Objects

/** Why a frame decoder gave up on a stream; nothing more is read from it afterwards. */
class FrameException(val reason: Reason, message: String) : Exception(message) {
    enum class Reason { NOT_JSON, TOO_LARGE }
}

/** A frame the hub was about to write is larger than a peer accepts; [limit] is MAX_FRAME_BYTES but in tests. */
class FrameTooLargeException(val bytes: Long, limit: Int = MAX_FRAME_BYTES) :
    RuntimeException("A frame of $bytes bytes exceeds the $limit byte limit")

/**
 * Streaming decoder over raw bytes: splits at 0x0A, decodes each line UTF-8 with REPLACE. 0x0A
 * never occurs inside a multi-byte sequence, so a character split across reads survives.
 */
class FrameDecoder(private val maxBytes: Int = MAX_FRAME_BYTES) {
    private var tail = ByteArray(INITIAL_CAPACITY)
    private var tailLength = 0
    private var failed = false

    /**
     * Values completed by this chunk, in order; throws FrameException (then the stream is dead).
     * Every line the chunk completes is size-checked before any is parsed, as the TypeScript
     * splitter runs before the parser. A failing chunk yields no value, not even of the lines before
     * the bad one: the TypeScript hub hangs up on such a chunk before it serves any of them either.
     */
    fun feed(bytes: ByteArray, offset: Int = 0, length: Int = bytes.size): List<JsonNode> {
        Objects.checkFromIndexSize(offset, length, bytes.size)
        check(!failed) { "The frame stream already failed" }
        val lines = ArrayList<String>()
        val end = offset + length
        var start = offset
        var newline = indexOfNewline(bytes, start, end)
        while (newline != -1) {
            checkSize(tailLength.toLong() + (newline - start))
            if (tailLength == 0) {
                lines += String(bytes, start, newline - start, Charsets.UTF_8)
            } else {
                append(bytes, start, newline)
                lines += String(tail, 0, tailLength, Charsets.UTF_8)
                clearTail()
            }
            start = newline + 1
            newline = indexOfNewline(bytes, start, end)
        }
        checkSize(tailLength.toLong() + (end - start))
        append(bytes, start, end)
        return lines.filterNot(::isJsBlank).map(::parseLine)
    }

    /** End of stream: the unterminated tail is dropped, never parsed. */
    fun end() {
        clearTail()
    }

    private fun parseLine(line: String): JsonNode = try {
        HubJson.parse(line)
    } catch (e: JsonNotParsed) {
        throw fail(FrameException.Reason.NOT_JSON, "A frame is not JSON: ${e.message}")
    }

    private fun checkSize(bytes: Long) {
        if (bytes > maxBytes) {
            throw fail(FrameException.Reason.TOO_LARGE, "A frame of $bytes bytes exceeds the $maxBytes byte limit")
        }
    }

    private fun fail(reason: FrameException.Reason, message: String): FrameException {
        failed = true
        clearTail()
        return FrameException(reason, message)
    }

    private fun append(bytes: ByteArray, from: Int, to: Int) {
        val needed = tailLength + (to - from)
        if (needed > tail.size) {
            tail = tail.copyOf(maxOf(needed.toLong(), minOf(tail.size * 2L, maxBytes.toLong())).toInt())
        }
        System.arraycopy(bytes, from, tail, tailLength, to - from)
        tailLength = needed
    }

    // A frame of a whole document grows the buffer to megabytes; the next frames need far less.
    private fun clearTail() {
        tailLength = 0
        if (tail.size > INITIAL_CAPACITY) tail = ByteArray(INITIAL_CAPACITY)
    }

    private fun indexOfNewline(bytes: ByteArray, from: Int, to: Int): Int {
        for (index in from until to) {
            if (bytes[index] == NEWLINE) return index
        }
        return -1
    }

    private companion object {
        const val INITIAL_CAPACITY = 64 * 1024
        const val NEWLINE: Byte = 0x0A
    }
}

/** UTF-8 bytes of json + "\n"; throws FrameTooLargeException when json exceeds MAX_FRAME_BYTES bytes. */
fun encodeFrame(json: String, maxBytes: Int = MAX_FRAME_BYTES): ByteArray {
    val bytes = json.toByteArray(Charsets.UTF_8)
    if (bytes.size > maxBytes) throw FrameTooLargeException(bytes.size.toLong(), maxBytes)
    return bytes.copyOf(bytes.size + 1).also { it[bytes.size] = '\n'.code.toByte() }
}

/**
 * JS String.prototype.trim() is empty. Kotlin's isBlank differs: it takes U+001C..U+001F as blank
 * and U+FEFF not, where JavaScript trims U+FEFF and keeps the others.
 */
fun isJsBlank(line: String): Boolean = line.all(::isJsWhitespace)

private fun isJsWhitespace(char: Char): Boolean = when (char) {
    '\t', '\n', '\u000B', '\u000C', '\r', ' ', '\u00A0', '\u1680',
    '\u2028', '\u2029', '\u202F', '\u205F', '\u3000', '\uFEFF',
    -> true
    else -> char in '\u2000'..'\u200A'
}
