package com.github.dineug.erdeditorintellijplugin.hub

import com.fasterxml.jackson.core.StreamReadFeature
import com.fasterxml.jackson.databind.node.BigIntegerNode
import com.fasterxml.jackson.databind.node.DoubleNode
import com.github.dineug.erdeditorintellijplugin.hub.testing.Corpus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger
import kotlin.random.Random

/**
 * The hub reads frames as JSON.parse does and writes them as JSON.stringify does, since its peer
 * is Node and the conformance corpus holds Node's bytes. Jackson's defaults differ in each of the
 * cases below: trailing tokens, a byte order mark, the 20,000,000-character string cap, the
 * nesting and number caps, a big integer parsed in quadratic time, upper-case escapes and 1.0 as a
 * non-integer.
 */
class HubJsonTest {

    @Test
    fun `parses what JSON parse accepts`() {
        assertEquals(1, HubJson.parse("1").intValue())
        assertEquals("s", HubJson.parse("\"s\"").textValue())
        assertTrue(HubJson.parse("null").isNull)
        assertTrue(HubJson.parse(" \t\r\n{\"a\":[1,2]} \r\n").isObject)
        assertEquals(1.0, HubJson.parse("1.0").asDouble(), 0.0)
        assertEquals(-5, HubJson.parse("-5").intValue())
    }

    @Test
    fun `refuses what JSON parse refuses`() {
        val refused = listOf(
            "", " ", "{\"id\":1} x", "{\"id\":1}}", "{\"id\":1}{}", "\uFEFF{\"id\":1}", "{\"a\":[1,]}",
            "{'a':1}", "NaN", "{\"a\":1}//c", "01", "+1", ".5", "1.", "{\"a\":1}\u000b", "{\"a\":\"\u0001\"}",
            "{\"a\":1}\u00a0", "Infinity", "[1 2]",
        )
        for (text in refused) {
            assertThrows("refuses ${HubJson.quote(text)}", JsonNotParsed::class.java) { HubJson.parse(text) }
        }
    }

    @Test
    fun `names the reason it refused a text`() {
        val empty = assertThrows(JsonNotParsed::class.java) { HubJson.parse("") }
        assertEquals("Unexpected end of JSON input", empty.message)
        val trailing = assertThrows(JsonNotParsed::class.java) { HubJson.parse("{\"id\":1} {") }
        assertEquals("Unexpected non-whitespace character after JSON at position 9", trailing.message)
        val bom = assertThrows(JsonNotParsed::class.java) { HubJson.parse("\uFEFF1") }
        assertTrue(bom.message!!.contains("U+FEFF"))
        val broken = assertThrows(JsonNotParsed::class.java) { HubJson.parse("{\"a\":") }
        assertNotNull(broken.cause)
    }

    @Test
    fun `keeps the last of duplicate keys in the place of the first`() {
        assertEquals("{\"a\":3,\"b\":2}", HubJson.stringify(HubJson.parse("{\"a\":1,\"b\":2,\"a\":3}")))
    }

    @Test
    fun `parses a string longer than twenty million characters`() {
        val text = "x".repeat(21_000_000)
        val node = HubJson.parse("{\"actions\":[{\"type\":\"memo.add\",\"payload\":{\"value\":\"$text\"}}]}")
        assertEquals(21_000_000, node["actions"][0]["payload"]["value"].textValue().length)
    }

    @Test
    fun `parses and writes deep nesting, long numbers, long keys and many keys`() {
        val deep = "[".repeat(1_500) + "]".repeat(1_500)
        assertEquals(deep, HubJson.stringify(HubJson.parse(deep)))

        val digits = "9".repeat(1_200)
        val huge = HubJson.parse(digits)
        assertTrue(huge is BigIntegerNode)
        assertEquals("null", HubJson.stringify(huge))
        assertEquals("[null]", HubJson.stringify(HubJson.parse("[$digits]")))

        val key = "k".repeat(60_000)
        assertEquals("{\"$key\":1}", HubJson.stringify(HubJson.parse("{\"$key\":1}")))

        val many = (0 until 100_000).joinToString(",", "{", "}") { "\"k$it\":$it" }
        assertEquals(100_000, HubJson.parse(many).size())
    }

    @Test(timeout = 20_000)
    fun `reads an integer of millions of digits at once and to the exact value`() {
        // Jackson's default, new BigInteger(String), takes about two minutes here; the fast parser under a second.
        assertTrue(HubJson.factory.isEnabled(StreamReadFeature.USE_FAST_BIG_NUMBER_PARSER))
        assertEquals("{\"id\":null}", HubJson.stringify(HubJson.parse("{\"id\":" + "9".repeat(3_200_000) + "}")))

        val random = Random(7)
        repeat(200) {
            val length = random.nextInt(20, 3_000)
            val text = (if (random.nextBoolean()) "-" else "") + (1..9).random(random) +
                (1 until length).joinToString("") { (0..9).random(random).toString() }
            assertEquals(text, BigInteger(text), HubJson.parse(text).bigIntegerValue())
        }
    }

    @Test
    fun `writes JavaScript numbers`() {
        val table = mapOf(
            1.0 to "1", 1.5 to "1.5", -0.0 to "0", 0.0 to "0", 1e21 to "1e+21", 1e-7 to "1e-7", 0.1 to "0.1",
            123456789012345680000.0 to "123456789012345680000", 5e-324 to "5e-324", 1e-323 to "1e-323",
            1.7976931348623157e308 to "1.7976931348623157e+308", Double.POSITIVE_INFINITY to "Infinity",
            Double.NEGATIVE_INFINITY to "-Infinity", Double.NaN to "NaN", 0.000001 to "0.000001",
            1e-6 to "0.000001", 1e20 to "100000000000000000000", 2.5e-7 to "2.5e-7", -1e-7 to "-1e-7",
            100.0 to "100", 0.001 to "0.001", 123.456 to "123.456", -42.0 to "-42", 1e22 to "1e+22",
            1.5e300 to "1.5e+300", 9007199254740993.0 to "9007199254740992", 3e-5 to "0.00003",
            1.25e-7 to "1.25e-7", 4.35 to "4.35",
        )
        for ((value, text) in table) assertEquals("jsNumber($value)", text, HubJson.jsNumber(value))
    }

    @Test
    fun `writes integral nodes up to 2^53 as integers and the rest as JavaScript reads them`() {
        val n = HubJson.nodes
        assertEquals("9007199254740992", HubJson.numberText(n.numberNode(9007199254740992L)))
        assertEquals("-9007199254740992", HubJson.numberText(n.numberNode(-9007199254740992L)))
        assertEquals("9007199254740992", HubJson.numberText(n.numberNode(9007199254740993L)))
        assertEquals("-9223372036854776000", HubJson.numberText(n.numberNode(Long.MIN_VALUE)))
        assertEquals("100000000000000000000", HubJson.numberText(n.numberNode(BigInteger.TEN.pow(20))))
        assertEquals("42", HubJson.numberText(n.numberNode(42)))
        assertEquals("1", HubJson.numberText(n.numberNode(1.0)))
        assertEquals("[1,2.5,1e+21]", HubJson.stringify(HubJson.parse("[1.0,2.5,1E21]")))
        assertEquals("[null,null]", HubJson.stringify(n.arrayNode().add(Double.NaN).add(Double.POSITIVE_INFINITY)))
    }

    @Test
    fun `escapes as JSON stringify does`() {
        assertEquals("\"\\u001f\"", HubJson.quote("\u001f"))
        assertEquals(
            "\"\\u0000\\u0001\\b\\t\\n\\u000b\\f\\r\\\"\\\\\u007f\"",
            HubJson.quote("\u0000\u0001\b\t\n\u000b\u000c\r\"\\\u007f"),
        )
        assertEquals("\"\\udc00\"", HubJson.quote("\udc00"))
        assertEquals("\"\\ud83d\"", HubJson.quote("\ud83d"))
        assertEquals("\"\\ud83dx\"", HubJson.quote("\ud83dx"))
        assertEquals("\"😀\"", HubJson.quote("😀"))
        assertEquals("\"/<>&\u2028\u2029\"", HubJson.quote("/<>&\u2028\u2029"))
        assertEquals("\"가\"", HubJson.quote("가"))
    }

    @Test
    fun `writes array-index keys first, ascending, as V8 re-stringifies a parsed object`() {
        val node = HubJson.parse("{\"b\":1,\"1\":2,\"0\":3,\"-1\":4,\"01\":5}")
        assertEquals("{\"0\":3,\"1\":2,\"b\":1,\"-1\":4,\"01\":5}", HubJson.stringify(node))
        val edges = HubJson.parse(
            "{\"x\":0,\"4294967295\":1,\"4294967294\":2,\"12345678901\":3,\"\":4,\"1a\":5,\"10\":6,\"2\":7}",
        )
        assertEquals(
            "{\"2\":7,\"10\":6,\"4294967294\":2,\"x\":0,\"4294967295\":1,\"12345678901\":3,\"\":4,\"1a\":5}",
            HubJson.stringify(edges),
        )
    }

    @Test
    fun `keeps nulls inside actions`() {
        val line = "{\"type\":\"x\",\"payload\":{\"id\":\"y\",\"comment\":null},\"list\":[null,true,false]}"
        assertEquals(line, HubJson.stringify(HubJson.parse(line)))
    }

    @Test
    fun `writes the corpus values byte for byte`() {
        for (case in Corpus.wire.framing.encode) {
            assertEquals(case.hex, encodeFrame(HubJson.stringify(case.value)).toHex())
        }
    }

    @Test
    fun `refuses a node JSON has no form for`() {
        val binary = HubJson.nodes.binaryNode(byteArrayOf(1))
        assertThrows(IllegalArgumentException::class.java) { HubJson.stringify(binary) }
        assertThrows(IllegalArgumentException::class.java) { HubJson.stringify(HubJson.nodes.missingNode()) }
    }

    @Test
    fun `reads records, integers and truthiness as JavaScript does`() {
        val n = HubJson.nodes
        assertTrue(HubJson.isRecord(n.objectNode()))
        assertFalse(HubJson.isRecord(n.arrayNode()))
        assertFalse(HubJson.isRecord(n.nullNode()))
        assertFalse(HubJson.isRecord(null))

        assertTrue(HubJson.isJsInteger(HubJson.parse("1.0")))
        assertTrue(HubJson.isJsInteger(HubJson.parse("9007199254740993")))
        assertTrue(HubJson.isJsInteger(HubJson.parse("1e21")))
        assertFalse(HubJson.isJsInteger(HubJson.parse("1.5")))
        assertFalse(HubJson.isJsInteger(HubJson.parse("1e400")))
        assertFalse(HubJson.isJsInteger(HubJson.parse("9".repeat(400))))
        assertFalse(HubJson.isJsInteger(HubJson.parse("\"1\"")))
        assertFalse(HubJson.isJsInteger(null))
        assertFalse(HubJson.isJsInteger(DoubleNode(Double.NaN)))

        assertTrue(HubJson.isSafeInteger(HubJson.parse("9007199254740991")))
        assertTrue(HubJson.isSafeInteger(HubJson.parse("-9007199254740991")))
        assertTrue(HubJson.isSafeInteger(HubJson.parse("1.0")))
        assertFalse(HubJson.isSafeInteger(HubJson.parse("9007199254740992")))
        assertFalse(HubJson.isSafeInteger(HubJson.parse("1.5")))
        assertFalse(HubJson.isSafeInteger(null))

        val truthy = listOf("true", "1", "-1", "0.5", "\"x\"", "{}", "[]", "1e400")
        val falsy = listOf("false", "0", "-0", "0.0", "1e-400", "\"\"", "null")
        for (text in truthy) assertTrue(text, HubJson.isTruthy(HubJson.parse(text)))
        for (text in falsy) assertFalse(text, HubJson.isTruthy(HubJson.parse(text)))
        assertFalse(HubJson.isTruthy(null))
        assertFalse(HubJson.isTruthy(DoubleNode(Double.NaN)))
        assertFalse(HubJson.isTruthy(n.missingNode()))
    }

    @Test
    fun `reads a lone surrogate escape and writes it back escaped`() {
        val node = HubJson.parse("\"\\udc00\"")
        assertEquals("\udc00", node.textValue())
        assertEquals("\"\\udc00\"", HubJson.stringify(node))
        assertNull(HubJson.parse("{}").get("missing"))
    }
}

internal fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

internal fun hexBytes(hex: String): ByteArray =
    ByteArray(hex.length / 2) { hex.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
