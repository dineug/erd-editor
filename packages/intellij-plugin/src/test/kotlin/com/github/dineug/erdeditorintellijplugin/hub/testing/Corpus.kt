package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.fasterxml.jackson.core.JsonFactory
import com.fasterxml.jackson.core.StreamReadConstraints
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.LockRecord
import java.nio.file.Files
import java.nio.file.Path

/**
 * The two conformance corpora the TypeScript hub is held to, read by the Kotlin suites:
 * packages/agent-hub's wire vectors and packages/agent-hub-host's connection, rule, join-window,
 * pipe-path and authorization vectors. Gradle names both files through system properties; a run
 * without them (an IDE's own runner) reads them relative to the Gradle project directory.
 *
 * Every section is read strictly when its corpus is first used: a missing or ill-typed field fails
 * that suite at once instead of reading as an empty table. Each section's "$comment" in the JSON
 * says how to read it.
 */
object Corpus {
    val wire: WireCorpus by lazy {
        WireCorpus(read("erd.hub.wireCorpus", "../agent-hub/src/__fixtures__/conformance.json"))
    }
    val host: HostCorpus by lazy {
        HostCorpus(read("erd.hub.hostCorpus", "../agent-hub-host/src/__fixtures__/conformance.json"))
    }

    // Plain Jackson rather than HubJson, so the reader under test does not also read its own vectors.
    private val mapper = ObjectMapper(
        JsonFactory.builder()
            .streamReadConstraints(StreamReadConstraints.builder().maxStringLength(Int.MAX_VALUE).build())
            .build()
    )

    private fun read(property: String, fallback: String): JsonNode {
        val path = Path.of(System.getProperty(property) ?: fallback)
        check(Files.isRegularFile(path)) { "The conformance corpus $path is missing ($property)" }
        return mapper.readTree(Files.readString(path))
    }
}

/** A HubRequestError as the corpus spells it: the code's wire name and the message. */
data class CorpusRefusal(val code: String, val message: String)

class WireCorpus(val root: JsonNode) {
    val protocolVersion: Int = root.req("protocolVersion").int()
    val maxFrameBytes: Int = root.req("maxFrameBytes").int()
    val errorCodes: List<String> = root.req("errorCodes").strings()
    val requestFrames: List<String> = root.req("frames").req("requests").strings()
    val toPeerFrames: List<String> = root.req("frames").req("toPeer").strings()
    val encoderNormalization: List<EncoderCase> = root.req("encoderNormalization").map {
        EncoderCase(it.req("direction").str(), it.req("input"), it.req("output").str())
    }
    val framing: FramingCorpus = FramingCorpus(root.req("framing"))
    val protocolMismatch: List<MismatchCase> = root.req("protocolMismatch").map {
        MismatchCase(it.req("hub").double(), it.req("client").double(), it.req("message").str())
    }
    val lock: LockCorpus = LockCorpus(root.req("lock"))
    val paths: PathsCorpus = PathsCorpus(root.req("paths"))

    /** direction is "request" or "notification"; output is the frame without its newline. */
    data class EncoderCase(val direction: String, val input: JsonNode, val output: String)

    data class MismatchCase(val hub: Double, val client: Double, val message: String)
}

class FramingCorpus(node: JsonNode) {
    val encode: List<EncodeCase> = node.req("encode").map { EncodeCase(it.req("value"), it.req("hex").str()) }
    val chunks: List<ChunkCase> = node.req("chunks").map { case ->
        ChunkCase(
            chunks = case.req("chunks").strings(),
            values = case.req("values").toList(),
            error = case.req("error").takeUnless { it.isNull }?.let {
                FrameErrorCase(it.req("reason").str(), it.req("messagePrefix").str())
            },
        )
    }
    val splitUtf8: SplitUtf8Case = node.req("splitUtf8").let {
        SplitUtf8Case(it.req("hex").str(), it.req("splitAfter").int(), it.req("value"))
    }
    val blank: List<BlankCase> = node.req("blank").map { BlankCase(it.req("line").str(), it.req("blank").bool()) }

    /** hex is the frame encodeFrame writes of value, its newline included. */
    data class EncodeCase(val value: JsonNode, val hex: String)

    /** The pieces one stream delivers, the values it yields, and how it failed, or null when it ended cleanly. */
    data class ChunkCase(val chunks: List<String>, val values: List<JsonNode>, val error: FrameErrorCase?)

    /** reason is "notJson" or "tooLarge". */
    data class FrameErrorCase(val reason: String, val messagePrefix: String)

    /** The bytes of hex fed as two reads, split after splitAfter bytes; the first alone yields nothing. */
    data class SplitUtf8Case(val hex: String, val splitAfter: Int, val value: JsonNode)

    data class BlankCase(val line: String, val blank: Boolean)
}

class LockCorpus(node: JsonNode) {
    val maxPipePathBytes: Int = node.req("maxPipePathBytes").int()
    val dirMode: Int = node.req("dirMode").int()
    val fileMode: Int = node.req("fileMode").int()

    /** record is the corpus record as a LockRecord, the keys it lacks dropped; text is its exact bytes. */
    val serialize: List<SerializeCase> = node.req("serialize").map {
        SerializeCase(it.req("record"), lockRecord(it.req("record")), it.req("text").str())
    }
    val parseNull: List<String> = node.req("parseNull").strings()
    val parseOk: List<ParseOkCase> = node.req("parseOk").map {
        ParseOkCase(it.req("raw").str(), lockRecord(it.req("record")))
    }
    val lockDirPath: List<LockDirCase> = node.req("lockDirPath").map {
        LockDirCase(it.req("home").str(), it.req("dir").str())
    }
    val lockFilePath: List<LockFileCase> = node.req("lockFilePath").map {
        LockFileCase(it.req("home").str(), it.req("pid").long(), it.req("path").str())
    }
    val lockFilePid: List<LockFilePidCase> = node.req("lockFilePid").map {
        LockFilePidCase(it.req("name").str(), it.req("pid").takeUnless(JsonNode::isNull)?.long())
    }
    val pipePath: List<PipePathCase> = node.req("pipePath").map {
        PipePathCase(it.req("home").str(), it.req("pid").long(), it.req("platform").platform(), it.req("pipe").str())
    }
    val pipePathFits: List<PipePathFitsCase> = node.req("pipePathFits").map {
        PipePathFitsCase(it.req("pipe").str(), it.req("platform").platform(), it.req("fits").bool())
    }

    data class SerializeCase(val input: JsonNode, val record: LockRecord, val text: String)
    data class ParseOkCase(val raw: String, val record: LockRecord)
    data class LockDirCase(val home: String, val dir: String)
    data class LockFileCase(val home: String, val pid: Long, val path: String)
    data class LockFilePidCase(val name: String, val pid: Long?)
    data class PipePathCase(val home: String, val pid: Long, val platform: HubPlatform, val pipe: String)
    data class PipePathFitsCase(val pipe: String, val platform: HubPlatform, val fits: Boolean)

    private fun lockRecord(node: JsonNode) = LockRecord(
        pipe = node.req("pipe").str(),
        workspaceFolders = node.req("workspaceFolders").strings(),
        documents = node.req("documents").strings(),
        ide = node.req("ide").str(),
        version = node.req("version").str(),
        protocolVersion = node.req("protocolVersion").long(),
        token = node.req("token").str(),
        hub = node.req("hub").bool(),
    )
}

class PathsCorpus(node: JsonNode) {
    val toSegments: List<SegmentsCase> = node.req("toSegments").map {
        SegmentsCase(it.req("path").str(), it.req("platform").platform(), it.req("segments").strings())
    }
    val isInside: List<InsideCase> = node.req("isInside").map {
        InsideCase(
            it.req("parent").str(), it.req("child").str(), it.req("platform").platform(), it.req("result").bool(),
        )
    }
    val isSamePath: List<SamePathCase> = node.req("isSamePath").map {
        SamePathCase(it.req("a").str(), it.req("b").str(), it.req("platform").platform(), it.req("result").bool())
    }
    val longestPrefixIndex: List<LongestPrefixCase> = node.req("longestPrefixIndex").map {
        LongestPrefixCase(
            it.req("folders").strings(), it.req("target").str(), it.req("platform").platform(), it.req("index").int(),
        )
    }
    val isAuthorized: List<AuthorizedCase> = node.req("isAuthorized").map {
        AuthorizedCase(
            it.req("folders").strings(), it.req("documents").strings(), it.req("target").str(),
            it.req("platform").platform(), it.req("result").bool(),
        )
    }

    /** error is the refusal authorize throws, or null when target is authorized. */
    val authorize: List<AuthorizeCase> = node.req("authorize").map {
        AuthorizeCase(
            it.req("folders").strings(), it.req("documents").strings(), it.req("target").str(),
            it.req("platform").platform(), it.req("error").refusalOrNull(),
        )
    }

    /** segment is the first name of path Windows does not store as written, or null. */
    val unsafeSegment: List<UnsafeSegmentCase> = node.req("unsafeSegment").map {
        UnsafeSegmentCase(it.req("path").str(), it.req("platform").platform(), it.req("segment").strOrNull())
    }

    data class SegmentsCase(val path: String, val platform: HubPlatform, val segments: List<String>)
    data class InsideCase(val parent: String, val child: String, val platform: HubPlatform, val result: Boolean)
    data class SamePathCase(val a: String, val b: String, val platform: HubPlatform, val result: Boolean)
    data class LongestPrefixCase(
        val folders: List<String>, val target: String, val platform: HubPlatform, val index: Int,
    )
    data class AuthorizedCase(
        val folders: List<String>, val documents: List<String>, val target: String,
        val platform: HubPlatform, val result: Boolean,
    )
    data class AuthorizeCase(
        val folders: List<String>, val documents: List<String>, val target: String,
        val platform: HubPlatform, val error: CorpusRefusal?,
    )
    data class UnsafeSegmentCase(val path: String, val platform: HubPlatform, val segment: String?)
}

class HostCorpus(val root: JsonNode) {
    val server: ServerCorpus = ServerCorpus(root.req("server"))
    val documentRules: DocumentRulesCorpus = DocumentRulesCorpus(root.req("documentRules"))
    val joinWindow: JoinWindowCorpus = JoinWindowCorpus(root.req("joinWindow"))
    val pipePath: PipePathCorpus = PipePathCorpus(root.req("pipePath"))
    val authz: AuthzCorpus = AuthzCorpus(root.req("authz"))
}

/**
 * One connection per scenario, served with token, ide and version. authorize(path) answers
 * authorizePrefix + path, or fails with authorizeRefuses[path]; the handler answers each call with
 * answers[method] (openDocument's with the path it was handed first), unless the scenario's
 * handlerRefuses[method] makes it fail. Sends are applied one piece at a time, the hub idle between.
 */
class ServerCorpus(node: JsonNode) {
    val token: String = node.req("token").str()
    val ide: String = node.req("ide").str()
    val version: String = node.req("version").str()
    val authorizePrefix: String = node.req("authorizePrefix").str()
    val authorizeRefuses: Map<String, CorpusRefusal> = node.req("authorizeRefuses").refusals()
    val answers: Map<String, ObjectNode> = node.req("answers").properties()
        .associate { (method, answer) -> method to answer.obj() }
    val scenarios: List<ServerScenario> = node.req("scenarios").map(::ServerScenario)
}

/** How a scenario leaves the connection: still serving, ended after its frames, or destroyed. */
enum class ScenarioEnd { OPEN, END, HANG_UP }

class ServerScenario(node: JsonNode) {
    val name: String = node.req("name").str()

    /** The pieces the peer writes, in order, exactly as written. */
    val send: List<String> = node.req("send").strings()

    /** Every frame the hub wrote, newline dropped. */
    val expect: List<String> = node.req("expect").strings()

    val then: ScenarioEnd = when (val then = node.req("then").str()) {
        "open" -> ScenarioEnd.OPEN
        "end" -> ScenarioEnd.END
        "hangUp" -> ScenarioEnd.HANG_UP
        else -> error("corpus: unknown then $then in $name")
    }

    /** Every path authorize was handed, in order, as the peer wrote it; refused params never reach it. */
    val authorized: List<String> = node.req("authorized").strings()

    val calls: List<ScenarioCall> = node.req("calls").map { call ->
        ScenarioCall(
            method = call.req("method").str(),
            path = call.req("path").strOrNull(),
            create = call.req("create").takeUnless(JsonNode::isNull)?.bool(),
            initialValue = call.req("initialValue").strOrNull(),
            actions = call.req("actions").takeUnless(JsonNode::isNull)?.arr(),
            client = call.req("client").str(),
        )
    }

    /** The texts the hub logged, in order, the prefix left out. */
    val logs: List<String> = node.req("logs").strings()

    /** The refusal the handler fails a method with in this scenario, by method. */
    val handlerRefuses: Map<String, CorpusRefusal> = node.get("handlerRefuses")?.refusals() ?: emptyMap()

    override fun toString(): String = name
}

/**
 * A handler call, normalized: the path of a method that names one, create by JavaScript
 * truthiness and initialValue when a string on openDocument, actions on applyActions, null otherwise.
 */
data class ScenarioCall(
    val method: String,
    val path: String?,
    val create: Boolean?,
    val initialValue: String?,
    val actions: ArrayNode?,
    val client: String,
)

class DocumentRulesCorpus(node: JsonNode) {
    val extensions: List<String> = node.req("extensions").strings()
    val openReadyTimeoutMs: Long = node.req("openReadyTimeoutMs").long()
    val saveQuietCapMs: Long = node.req("saveQuietCapMs").long()

    /** problem is the badRequest message erdFileProblem answers path with, or null. */
    val erdFile: List<ErdFileCase> = node.req("erdFile").map {
        ErdFileCase(it.req("path").str(), it.req("problem").strOrNull())
    }

    /** name is the refusal's constructor in documentRules.ts, called with args. */
    val refusals: List<RefusalCase> = node.req("refusals").map {
        RefusalCase(it.req("name").str(), it.req("args").strings(), it.req("code").str(), it.req("message").str())
    }
    val logs: List<LogCase> = node.req("logs").map {
        LogCase(it.req("name").str(), it.req("args").strings(), it.req("text").str())
    }
    val stripBom: List<StripBomCase> = node.req("stripBom").map {
        StripBomCase(it.req("input").str(), it.req("output").str())
    }

    data class ErdFileCase(val path: String, val problem: String?)
    data class RefusalCase(val name: String, val args: List<String>, val code: String, val message: String)
    data class LogCase(val name: String, val args: List<String>, val text: String)
    data class StripBomCase(val input: String, val output: String)
}

/** Sources are spelled "webview" and "peer"; a null version is none; dropped counts by source, then by action type. */
class JoinWindowCorpus(node: JsonNode) {
    val replicaDebounceMs: Long = node.req("replicaDebounceMs").long()
    val joinQuietCapMs: Long = node.req("joinQuietCapMs").long()
    val nonChangeTypes: List<String> = node.req("nonChangeTypes").strings()
    val actionVersion: List<ActionVersionCase> = node.req("actionVersion").map {
        ActionVersionCase(it.req("action"), it.req("version").takeUnless(JsonNode::isNull)?.double())
    }
    val actionType: List<ActionTypeCase> = node.req("actionType").map {
        ActionTypeCase(it.req("action"), it.req("type").str())
    }
    val hasChangeAction: List<HasChangeCase> = node.req("hasChangeAction").map {
        HasChangeCase(it.req("actions").arr(), it.req("result").bool())
    }
    val maxVersion: List<MaxVersionCase> = node.req("maxVersion").map {
        MaxVersionCase(it.req("current").double(), it.req("actions").arr(), it.req("result").double())
    }
    val filterJoinQueue: List<FilterCase> = node.req("filterJoinQueue").map {
        FilterCase(
            queue = it.req("queue").batches(),
            snapshotVersion = it.req("snapshotVersion").double(),
            batches = it.req("batches").batches(),
            dropped = it.req("dropped").dropped(),
            droppedCount = it.req("droppedCount").int(),
        )
    }
    val drainJoinQueue: List<DrainCase> = node.req("drainJoinQueue").map { case ->
        DrainCase(
            queue = case.req("queue").batches(),
            captured = case.req("captured").int(),
            snapshotVersion = case.req("snapshotVersion").double(),
            path = case.req("path").str(),
            batches = case.req("batches").batches(),
            warning = case.req("warning").takeUnless(JsonNode::isNull)?.let {
                DrainWarning(it.req("text").str(), it.req("dropped").dropped())
            },
        )
    }

    data class ActionVersionCase(val action: JsonNode, val version: Double?)
    data class ActionTypeCase(val action: JsonNode, val type: String)
    data class HasChangeCase(val actions: ArrayNode, val result: Boolean)
    data class MaxVersionCase(val current: Double, val actions: ArrayNode, val result: Double)
    data class Batch(val source: String, val actions: ArrayNode)
    data class FilterCase(
        val queue: List<Batch>, val snapshotVersion: Double, val batches: List<Batch>,
        val dropped: Map<String, Map<String, Int>>, val droppedCount: Int,
    )
    data class DrainCase(
        val queue: List<Batch>, val captured: Int, val snapshotVersion: Double, val path: String,
        val batches: List<Batch>, val warning: DrainWarning?,
    )
    data class DrainWarning(val text: String, val dropped: Map<String, Map<String, Int>>)

    private fun JsonNode.batches(): List<Batch> = map { Batch(it.req("source").str(), it.req("actions").arr()) }

    private fun JsonNode.dropped(): Map<String, Map<String, Int>> = properties().associate { (source, byType) ->
        source to byType.properties().associate { (type, count) -> type to count.int() }
    }
}

class PipePathCorpus(node: JsonNode) {
    val tmpPipePath: List<TmpPipeCase> = node.req("tmpPipePath").map {
        TmpPipeCase(it.req("tmp").str(), it.req("pid").long(), it.req("pipe").str())
    }
    val choosePipePath: List<ChoosePipeCase> = node.req("choosePipePath").map {
        ChoosePipeCase(
            it.req("home").str(), it.req("tmp").str(), it.req("pid").long(), it.req("platform").platform(),
            it.req("pipe").strOrNull(),
        )
    }
    val socketFilePaths: List<SocketFilesCase> = node.req("socketFilePaths").map {
        SocketFilesCase(
            it.req("home").str(), it.req("tmp").str(), it.req("pid").long(), it.req("platform").platform(),
            it.req("paths").strings(),
        )
    }

    data class TmpPipeCase(val tmp: String, val pid: Long, val pipe: String)
    data class ChoosePipeCase(
        val home: String, val tmp: String, val pid: Long, val platform: HubPlatform, val pipe: String?,
    )
    data class SocketFilesCase(
        val home: String, val tmp: String, val pid: Long, val platform: HubPlatform, val paths: List<String>,
    )
}

/**
 * A machine per vector: realPath maps a path equal to a links key, or under it, onto the key's
 * target and succeeds when that path exists, case included; only the first key that matches, in
 * the order written, is followed, and only once. lstat finds an entry at a links key even when its
 * target is missing. existing holds the paths that exist, each with every ancestor; failing the
 * paths whose realPath fails for a reason other than a missing entry.
 */
class AuthzCorpus(node: JsonNode) {
    val resolve: List<ResolveCase> = node.req("resolve").map {
        ResolveCase(
            it.req("platform").platform(), it.req("links").links(), it.req("existing").strings(),
            it.req("failing").strings(), it.req("target").str(), it.req("real").strOrNull(),
        )
    }
    val authorize: List<AuthorizeCase> = node.req("authorize").map {
        AuthorizeCase(
            it.req("platform").platform(), it.req("links").links(), it.req("existing").strings(),
            it.req("failing").strings(), it.req("folders").strings(), it.req("documents").strings(),
            it.req("target").str(), it.req("real").strOrNull(), it.req("error").refusalOrNull(),
        )
    }

    /** real is resolveRealPath of target, null when no safe real path exists. */
    data class ResolveCase(
        val platform: HubPlatform, val links: Map<String, String>, val existing: List<String>,
        val failing: List<String>, val target: String, val real: String?,
    )

    /** authorizePath of target is real, or fails with error. */
    data class AuthorizeCase(
        val platform: HubPlatform, val links: Map<String, String>, val existing: List<String>,
        val failing: List<String>, val folders: List<String>, val documents: List<String>,
        val target: String, val real: String?, val error: CorpusRefusal?,
    )

    // A LinkedHashMap: the first key that matches, in the order written, is the one followed.
    private fun JsonNode.links(): Map<String, String> =
        properties().associateTo(LinkedHashMap()) { (from, to) -> from to to.str() }
}

private fun JsonNode.req(key: String): JsonNode = get(key) ?: error("corpus: missing $key in ${toString().take(120)}")

private fun JsonNode.str(): String = if (isTextual) textValue() else error("corpus: $this is not a string")

private fun JsonNode.strOrNull(): String? = if (isNull) null else str()

private fun JsonNode.int(): Int = if (isInt) intValue() else error("corpus: $this is not an int")

private fun JsonNode.long(): Long =
    if (isIntegralNumber && canConvertToLong()) longValue() else error("corpus: $this is not a long")

private fun JsonNode.double(): Double = if (isNumber) asDouble() else error("corpus: $this is not a number")

private fun JsonNode.bool(): Boolean = if (isBoolean) booleanValue() else error("corpus: $this is not a boolean")

private fun JsonNode.arr(): ArrayNode = this as? ArrayNode ?: error("corpus: $this is not an array")

private fun JsonNode.obj(): ObjectNode = this as? ObjectNode ?: error("corpus: $this is not an object")

private fun JsonNode.strings(): List<String> = arr().map { it.str() }

private fun JsonNode.platform(): HubPlatform =
    HubPlatform.of(str()).also { check(it != HubPlatform.OTHER) { "corpus: unknown platform $this" } }

private fun JsonNode.refusal(): CorpusRefusal = CorpusRefusal(req("code").str(), req("message").str())

private fun JsonNode.refusalOrNull(): CorpusRefusal? = if (isNull) null else refusal()

private fun JsonNode.refusals(): Map<String, CorpusRefusal> =
    obj().properties().associate { (key, value) -> key to value.refusal() }
