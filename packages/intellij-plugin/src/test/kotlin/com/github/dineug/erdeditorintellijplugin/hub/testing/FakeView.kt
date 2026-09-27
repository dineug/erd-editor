package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.fasterxml.jackson.databind.node.ArrayNode
import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentRegistry
import com.github.dineug.erdeditorintellijplugin.hub.document.HubView
import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.CopyOnWriteArrayList

/**
 * An ERD editor's page as the registry sees it: it records what reaches it, in one ordered log of
 * initial values and injected batches, and answers writeNow with writeResult. Attached to a registry,
 * it can also act as the page's replica, saving its text a while after a batch reached it.
 */
class FakeView(val name: String = "view") : HubView {
    /** What reached the page, in the order it was enqueued. */
    sealed interface Event {
        data class Initial(val value: String) : Event

        data class Injected(val actions: String) : Event
    }

    private val log = CopyOnWriteArrayList<Event>()
    private val pushes = CopyOnWriteArrayList<Boolean>()
    private val writes = CopyOnWriteArrayList<String>()

    val events: List<Event> get() = log.toList()
    val initialValues: List<String> get() = log.filterIsInstance<Event.Initial>().map { it.value }

    /** Every injected batch, written as JSON. */
    val injected: List<String> get() = log.filterIsInstance<Event.Injected>().map { it.actions }
    val readonlyPushes: List<Boolean> get() = pushes.toList()

    /** The value latest() gave each writeNow, read once the write ran. */
    val writeCalls: List<String> get() = writes.toList()

    /** What writeNow answers: a Boolean, or a Throwable it throws. */
    @Volatile
    var writeResult: Any = true

    /** When set, writeNow waits for it before it reads latest(), as a write action waits for the EDT. */
    @Volatile
    var writeGate: CompletableDeferred<Unit>? = null

    /** The document as the page's replica holds it. */
    @Volatile
    var text: String = ""

    /** How a batch changes text; by default it appends the batch, so a save shows what it holds. */
    @Volatile
    var applyBatch: (String, ArrayNode) -> String = { current, actions -> current + HubJson.stringify(actions) }

    /** The replica saves text this long after a batch injected into the page; null: never on its own. */
    @Volatile
    var saveAfterInjectMs: Long? = null

    /** The same for a batch the page relays itself. */
    @Volatile
    var saveAfterRelayMs: Long? = null

    private var owner: Owner? = null

    private class Owner(val registry: DocumentRegistry, val file: DocumentFile, val threads: HubThreads)

    /** Lets relay and the replica's saves reach registry as the view of file. */
    fun attach(registry: DocumentRegistry, file: DocumentFile, threads: HubThreads): FakeView = also {
        owner = Owner(registry, file, threads)
    }

    override fun sendInitialValue(value: String) {
        log += Event.Initial(value)
        text = value
    }

    override fun inject(actions: ArrayNode) {
        log += Event.Injected(HubJson.stringify(actions))
        text = applyBatch(text, actions)
        saveAfterInjectMs?.let(::saveLater)
    }

    override fun pushReadonly(readonly: Boolean) {
        pushes += readonly
    }

    override suspend fun writeNow(latest: () -> String): Boolean {
        writeGate?.await()
        writes += latest()
        return when (val result = writeResult) {
            is Throwable -> throw result
            else -> result as Boolean
        }
    }

    /** The page's own edit: its shared store emits actions, which the registry relays. */
    fun relay(actions: ArrayNode) {
        val owner = checkNotNull(owner) { "$name is not attached" }
        text = applyBatch(text, actions)
        owner.registry.post { onViewActions(owner.file, this@FakeView, actions) }
        saveAfterRelayMs?.let(::saveLater)
    }

    private fun saveLater(delayMs: Long) {
        val owner = checkNotNull(owner) { "$name is not attached" }
        owner.threads.schedule(delayMs) { owner.registry.onValueSaved(owner.file, this, text) }
    }

    override fun toString(): String = "FakeView($name)"
}
