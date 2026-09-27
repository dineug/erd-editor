package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.server.HubDocuments
import com.github.dineug.erdeditorintellijplugin.hub.server.HubPublisher
import java.util.concurrent.CompletableFuture
import java.util.concurrent.atomic.AtomicInteger

/**
 * A documents double, as agent-hub-host's createMemoryDocuments: like a registry, it publishes what
 * it holds the moment the hub hands it the publisher; publish is a later change.
 */
class MemoryDocuments(private val open: List<String> = emptyList()) : HubDocuments {
    @Volatile
    var publisher: HubPublisher? = null
        private set

    val setPublisherCalls: AtomicInteger = AtomicInteger()

    override fun setPublisher(publisher: HubPublisher?) {
        setPublisherCalls.incrementAndGet()
        this.publisher = publisher
        publisher?.publish(open)
    }

    /** Publishes through the hub's publisher, as the registry does on a change. */
    fun publish(documents: List<String>): CompletableFuture<Unit> =
        (publisher ?: throw IllegalStateException("the hub has handed over no publisher")).publish(documents)
}
