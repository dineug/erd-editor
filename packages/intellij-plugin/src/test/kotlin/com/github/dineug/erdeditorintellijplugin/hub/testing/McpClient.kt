package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import java.io.IOException
import java.nio.file.Path
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicInteger

/**
 * A coding agent's MCP client over the stdio of the built ERD Editor MCP server, as e2e/mcp.mjs is
 * one: JSON-RPC lines on its stdin and stdout. tools() reads the schemas tools/list gives, and call
 * refuses an argument the tool's schema does not declare, so a suite passes only what the server takes.
 */
class McpClient private constructor(private val process: Process) : AutoCloseable {
    /** A tool call's answer: its text blocks, the JSON of the first, and the notes of any block. */
    class ToolResult(val isError: Boolean, val text: String, val json: JsonNode?, val notes: List<String>) {
        val mode: String? get() = json?.get("mode")?.textValue()
        val errorCode: String? get() = json?.path("error")?.get("code")?.textValue()
        val errorMessage: String? get() = json?.path("error")?.get("message")?.textValue()

        override fun toString(): String = text + if (notes.isEmpty()) "" else " notes=$notes"
    }

    private val pending = ConcurrentHashMap<Int, CompletableFuture<JsonNode>>()
    private val ids = AtomicInteger()
    private val errors = StringBuffer()

    @Volatile
    private var schemas: Map<String, JsonNode>? = null

    /** Everything the server wrote to stderr so far, which a failing suite prints. */
    val stderr: String get() = errors.toString()

    init {
        daemon("erd-mcp-client-stdout") {
            process.inputStream.bufferedReader(Charsets.UTF_8).useLines { lines ->
                for (line in lines) answer(line)
            }
            val exited = IOException("the MCP server closed its stdout; stderr: $stderr")
            pending.values.forEach { it.completeExceptionally(exited) }
        }
        daemon("erd-mcp-client-stderr") {
            process.errorStream.bufferedReader(Charsets.UTF_8).useLines { lines -> lines.forEach { errors.append(it).append('\n') } }
        }
    }

    /** initialize, then notifications/initialized, as an agent starts every session. */
    fun initialize(clientName: String): JsonNode {
        val params = HubJson.nodes.objectNode()
            .put("protocolVersion", PROTOCOL_VERSION)
            .set<ObjectNode>("capabilities", HubJson.nodes.objectNode())
            .set<ObjectNode>("clientInfo", HubJson.nodes.objectNode().put("name", clientName).put("version", "0"))
        val result = request("initialize", params, CALL_TIMEOUT_MS)
        write(HubJson.nodes.objectNode().put("jsonrpc", "2.0").put("method", "notifications/initialized"))
        return result
    }

    /** Every tool's input schema by name, as tools/list gives them; read once. */
    fun tools(): Map<String, JsonNode> = schemas ?: request("tools/list", HubJson.nodes.objectNode(), CALL_TIMEOUT_MS)
        .path("tools").associate { it.path("name").asText() to it.path("inputSchema") }
        .also { schemas = it }

    /** Calls a tool with string or boolean arguments, each one its schema declares, its required ones all given. */
    fun call(name: String, arguments: Map<String, Any>, timeoutMs: Long = CALL_TIMEOUT_MS): ToolResult {
        val schema = checkNotNull(tools()[name]) { "the server lists no tool $name" }
        val declared = schema.path("properties").fieldNames().asSequence().toSet()
        val undeclared = arguments.keys - declared
        check(undeclared.isEmpty()) { "$name declares no argument $undeclared, only $declared" }
        val missing = schema.path("required").map(JsonNode::asText).toSet() - arguments.keys
        check(missing.isEmpty()) { "$name requires $missing" }

        val args = HubJson.nodes.objectNode()
        for ((key, value) in arguments) {
            when (value) {
                is String -> args.put(key, value)
                is Boolean -> args.put(key, value)
                else -> throw IllegalArgumentException("$key is neither a string nor a boolean: $value")
            }
        }
        val params = HubJson.nodes.objectNode().put("name", name).set<ObjectNode>("arguments", args)
        val result = request("tools/call", params, timeoutMs)
        val blocks = result.path("content").map { it.path("text").asText() }
        val parsed = blocks.map { runCatching { HubJson.parse(it) }.getOrNull() }
        return ToolResult(
            isError = result.path("isError").asBoolean(false),
            text = blocks.joinToString("\n"),
            json = parsed.firstOrNull(),
            notes = parsed.flatMap { block -> block?.get("notes")?.map(JsonNode::asText).orEmpty() },
        )
    }

    /** Stops the server; its end of stdin closes every session it holds. */
    override fun close() {
        process.destroy()
        if (!process.waitFor(5, TimeUnit.SECONDS)) process.destroyForcibly().waitFor(5, TimeUnit.SECONDS)
    }

    private fun request(method: String, params: ObjectNode, timeoutMs: Long): JsonNode {
        val id = ids.incrementAndGet()
        val answer = CompletableFuture<JsonNode>().also { pending[id] = it }
        write(HubJson.nodes.objectNode().put("jsonrpc", "2.0").put("id", id).put("method", method).set<ObjectNode>("params", params))
        val response = try {
            answer.get(timeoutMs, TimeUnit.MILLISECONDS)
        } catch (e: TimeoutException) {
            throw AssertionError("$method got no answer within $timeoutMs ms; stderr: $stderr")
        } catch (e: ExecutionException) {
            throw AssertionError("$method failed: ${e.cause?.message}", e.cause)
        } finally {
            pending.remove(id)
        }
        response.get("error")?.let { throw AssertionError("$method was answered with an error: ${HubJson.stringify(it)}") }
        return response.path("result")
    }

    private fun write(message: ObjectNode) {
        val line = HubJson.stringify(message) + "\n"
        synchronized(process) {
            process.outputStream.write(line.toByteArray(Charsets.UTF_8))
            process.outputStream.flush()
        }
    }

    /** A response completes its request; a line that is no JSON, or no answer, is the server's own business. */
    private fun answer(line: String) {
        val message = runCatching { HubJson.parse(line) }.getOrNull() ?: return
        val id = message.get("id")?.takeIf { it.canConvertToInt() }?.intValue() ?: return
        pending[id]?.complete(message)
    }

    companion object {
        const val PROTOCOL_VERSION = "2025-06-18"
        const val CALL_TIMEOUT_MS = 45_000L

        /** Whether node --version runs; node is a path or a name looked up on PATH. */
        fun nodeRuns(node: String): Boolean = try {
            val process = ProcessBuilder(node, "--version").redirectErrorStream(true).start()
            process.inputStream.readAllBytes()
            process.waitFor(30, TimeUnit.SECONDS) && process.exitValue() == 0
        } catch (e: IOException) {
            false
        }

        /**
         * Starts node bin in cwd, where it resolves relative paths, with HOME and USERPROFILE set to
         * home in the child's environment only, so it discovers the locks under home and no others.
         */
        fun start(node: String, bin: Path, cwd: Path, home: String): McpClient {
            val builder = ProcessBuilder(node, bin.toString()).directory(cwd.toFile())
            builder.environment()["HOME"] = home
            builder.environment()["USERPROFILE"] = home
            return McpClient(builder.start())
        }

        private fun daemon(name: String, body: () -> Unit) {
            Thread(body, name).apply { isDaemon = true }.start()
        }
    }
}
