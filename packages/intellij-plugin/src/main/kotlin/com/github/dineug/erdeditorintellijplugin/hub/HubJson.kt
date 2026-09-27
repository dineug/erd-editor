package com.github.dineug.erdeditorintellijplugin.hub

import com.fasterxml.jackson.core.JsonFactory
import com.fasterxml.jackson.core.JsonProcessingException
import com.fasterxml.jackson.core.StreamReadConstraints
import com.fasterxml.jackson.core.StreamReadFeature
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.fasterxml.jackson.databind.node.JsonNodeType
import java.math.BigDecimal

/**
 * The hub's own JSON: a reader as strict as JSON.parse and a writer whose bytes match
 * JSON.stringify, since the peer and the conformance corpus are Node's. Jackson parses; the writer
 * is hand-written, because Jackson escapes control characters in upper case.
 *
 * Never the plugin's WebviewScripts.mapper: that one drops null fields, which actions carry.
 */
object HubJson {
    /**
     * StreamReadConstraints: maxStringLength, maxNestingDepth, maxNumberLength and maxNameLength
     * all MAX_FRAME_BYTES, since a frame is the only bound JSON.parse knows;
     * JsonFactory.Feature.CANONICALIZE_FIELD_NAMES off (no symbol table, so no hash-overflow refusal).
     */
    val factory: JsonFactory = JsonFactory.builder()
        .streamReadConstraints(
            StreamReadConstraints.builder()
                .maxStringLength(MAX_FRAME_BYTES)
                .maxNestingDepth(MAX_FRAME_BYTES)
                .maxNumberLength(MAX_FRAME_BYTES)
                .maxNameLength(MAX_FRAME_BYTES)
                .build()
        )
        .disable(JsonFactory.Feature.CANONICALIZE_FIELD_NAMES)
        // An integer beyond a long otherwise goes through new BigInteger(String), quadratic in its
        // digits (hours of one thread for a 64 MiB frame read before hello); this parser gives the
        // same value in near-linear time.
        .enable(StreamReadFeature.USE_FAST_BIG_NUMBER_PARSER)
        .build()

    /** readTree only. Duplicate keys keep the last value and no JsonReadFeature.ALLOW_* is on, as in JSON.parse. */
    val mapper: ObjectMapper = ObjectMapper(factory)

    val nodes: JsonNodeFactory = mapper.nodeFactory

    private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991.0
    private const val TWO_POW_53 = 9_007_199_254_740_992L
    private const val MAX_ARRAY_INDEX = 4_294_967_294L

    /** JSON.parse: refuses a leading U+FEFF and trailing tokens; throws JsonNotParsed. */
    fun parse(text: String): JsonNode {
        // Whether Jackson skips a byte order mark depends on the source, JSON.parse never does.
        if (text.startsWith('\uFEFF')) throw JsonNotParsed("Unexpected token U+FEFF at position 0", null)
        try {
            factory.createParser(text).use { parser ->
                val node: JsonNode = mapper.readTree(parser)
                    ?: throw JsonNotParsed("Unexpected end of JSON input", null)
                if (parser.nextToken() != null) {
                    throw JsonNotParsed(
                        "Unexpected non-whitespace character after JSON at position " +
                            parser.currentTokenLocation().charOffset,
                        null,
                    )
                }
                return node
            }
        } catch (e: JsonProcessingException) {
            throw JsonNotParsed(e.originalMessage, e)
        }
    }

    /**
     * JSON.stringify(value) of a parsed tree: compact, raw UTF-8, lowercase \u00xx escapes for
     * U+0000..U+001F except \b\t\n\f\r, escapes lone surrogates as \udxxx, never escapes / < > &
     * U+2028 U+2029; numbers through jsNumber; a non-finite double writes null.
     */
    fun stringify(node: JsonNode): String = StringBuilder().also { write(it, node) }.toString()

    /** JSON.stringify(string). */
    fun quote(value: String): String = StringBuilder(value.length + 2).also { writeString(it, value) }.toString()

    /**
     * Number.prototype.toString: 1.0→"1", -0.0→"0", 1e21→"1e+21", 1e-7→"1e-7", 0.1→"0.1",
     * ±Infinity→"Infinity"/"-Infinity", NaN→"NaN" (only messages use the last three).
     */
    fun jsNumber(value: Double): String = when {
        value.isNaN() -> "NaN"
        value == 0.0 -> "0"
        value == Double.POSITIVE_INFINITY -> "Infinity"
        value == Double.NEGATIVE_INFINITY -> "-Infinity"
        value < 0 -> "-" + jsNumber(-value)
        else -> shortestDecimal(value).toJs()
    }

    /** Integral nodes with |v| ≤ 2^53 print as integers; any other number as jsNumber(asDouble()). */
    fun numberText(node: JsonNode): String {
        if (node.isIntegralNumber && node.canConvertToLong()) {
            val value = node.longValue()
            if (value in -TWO_POW_53..TWO_POW_53) return value.toString()
        }
        return jsNumber(node.asDouble())
    }

    /** An object: not an array, not null. */
    fun isRecord(node: JsonNode?): Boolean = node != null && node.isObject

    /** Number.isInteger: a finite number equal to its integral part. */
    fun isJsInteger(node: JsonNode?): Boolean {
        if (node == null || !node.isNumber) return false
        val value = node.asDouble()
        return value.isFinite() && value == Math.rint(value)
    }

    /** Number.isSafeInteger: an integer of magnitude at most 2^53 - 1, as JavaScript reads the literal. */
    fun isSafeInteger(node: JsonNode?): Boolean = isJsInteger(node) && Math.abs(node!!.asDouble()) <= MAX_SAFE_INTEGER

    /** JavaScript truthiness: true, a non-zero number, a non-empty string, an object or an array. */
    fun isTruthy(node: JsonNode?): Boolean = when (node?.nodeType) {
        JsonNodeType.BOOLEAN -> node.booleanValue()
        JsonNodeType.NUMBER -> node.asDouble().let { it != 0.0 && !it.isNaN() }
        JsonNodeType.STRING -> node.textValue().isNotEmpty()
        JsonNodeType.OBJECT, JsonNodeType.ARRAY -> true
        else -> false
    }

    private fun write(out: StringBuilder, node: JsonNode) {
        when (node.nodeType) {
            JsonNodeType.OBJECT -> writeObject(out, node)
            JsonNodeType.ARRAY -> {
                out.append('[')
                node.forEachIndexed { index, element ->
                    if (index > 0) out.append(',')
                    write(out, element)
                }
                out.append(']')
            }
            JsonNodeType.STRING -> writeString(out, node.textValue())
            JsonNodeType.NUMBER -> out.append(if (node.asDouble().isFinite()) numberText(node) else "null")
            JsonNodeType.BOOLEAN -> out.append(node.booleanValue())
            JsonNodeType.NULL -> out.append("null")
            else -> throw IllegalArgumentException("A ${node.nodeType} node has no JSON form")
        }
    }

    // V8 keeps the array-index keys of a parsed object apart and enumerates them first, ascending.
    private fun writeObject(out: StringBuilder, node: JsonNode) {
        val entries = node.properties()
        val (indexed, named) = entries.partition { arrayIndex(it.key) != null }
        out.append('{')
        (indexed.sortedBy { arrayIndex(it.key) } + named).forEachIndexed { index, (key, value) ->
            if (index > 0) out.append(',')
            writeString(out, key)
            out.append(':')
            write(out, value)
        }
        out.append('}')
    }

    /** The value of a canonical array index "0" … "4294967294", or null for any other key. */
    private fun arrayIndex(key: String): Long? {
        if (key.isEmpty() || key.length > 10 || (key.length > 1 && key[0] == '0')) return null
        if (!key.all { it in '0'..'9' }) return null
        return key.toLong().takeIf { it <= MAX_ARRAY_INDEX }
    }

    private fun writeString(out: StringBuilder, value: String) {
        out.append('"')
        var index = 0
        while (index < value.length) {
            val char = value[index]
            when {
                char == '"' -> out.append("\\\"")
                char == '\\' -> out.append("\\\\")
                char == '\b' -> out.append("\\b")
                char == '\t' -> out.append("\\t")
                char == '\n' -> out.append("\\n")
                char == '\u000C' -> out.append("\\f")
                char == '\r' -> out.append("\\r")
                char < ' ' -> escape(out, char)
                char.isHighSurrogate() && index + 1 < value.length && value[index + 1].isLowSurrogate() -> {
                    out.append(char).append(value[index + 1])
                    index++
                }
                char.isSurrogate() -> escape(out, char)
                else -> out.append(char)
            }
            index++
        }
        out.append('"')
    }

    private fun escape(out: StringBuilder, char: Char) {
        val hex = Integer.toHexString(char.code)
        out.append("\\u").append("0".repeat(4 - hex.length)).append(hex)
    }

    /** s × 10^(n - k), k the digits of s: the terms of ECMAScript Number::toString. */
    private class Decimal(val digits: String, val point: Int) {
        fun toJs(): String {
            val k = digits.length
            return when (point) {
                in k..21 -> digits + "0".repeat(point - k)
                in 1..21 -> digits.substring(0, point) + "." + digits.substring(point)
                in -5..0 -> "0." + "0".repeat(-point) + digits
                else -> {
                    val exponent = point - 1
                    val sign = if (exponent < 0) "-" else "+"
                    val mantissa = if (k == 1) digits else digits[0] + "." + digits.substring(1)
                    "${mantissa}e$sign${Math.abs(exponent)}"
                }
            }
        }
    }

    /**
     * The shortest digits of a positive finite [value], from Double.toString (shortest round-trip
     * since JDK 19). Where one digit would do, the JDK also weighs two and keeps the closer, so
     * 5e-324 prints 4.9E-324; ECMAScript takes the fewest digits, so one digit is tried first.
     */
    private fun shortestDecimal(value: Double): Decimal {
        val text = value.toString()
        val e = text.indexOf('E')
        val mantissa = if (e < 0) text else text.substring(0, e)
        val exponent = if (e < 0) 0 else text.substring(e + 1).toInt()
        val dot = mantissa.indexOf('.')
        val raw = mantissa.substring(0, dot) + mantissa.substring(dot + 1)
        val leading = raw.indexOfFirst { it != '0' }
        val digits = raw.substring(leading).trimEnd('0')
        val point = dot + exponent - leading
        if (digits.length != 2) return Decimal(digits, point)

        val exact = BigDecimal(value)
        val first = digits[0].digitToInt()
        val single = listOf(first, first + 1)
            .map { BigDecimal(it).scaleByPowerOfTen(point - 1) }
            .filter { it.toString().toDouble() == value }
            .minByOrNull { (it - exact).abs() }
            ?: return Decimal(digits, point)
        val unscaled = single.unscaledValue().toString().trimEnd('0')
        return Decimal(unscaled, single.precision() - single.scale())
    }
}

/** A text JSON.parse would refuse, with the reason. */
class JsonNotParsed(message: String, cause: Throwable?) : Exception(message, cause)
