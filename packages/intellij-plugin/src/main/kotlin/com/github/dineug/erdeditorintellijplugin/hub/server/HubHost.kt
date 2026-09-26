package com.github.dineug.erdeditorintellijplugin.hub.server

import java.util.concurrent.CompletableFuture

/** What the hub needs from the IDE: whether it may serve, and the folders the lock lists. */
interface HubHost {
    /** The lock's and the hello answer's ide: "intellij" in production. */
    val ide: String

    fun isEnabled(): Boolean

    /**
     * Local paths; the hub realpaths them. Suspends (cancellable readAction), never blocks on a
     * read lock, since the plugin's dispose runs inside a write action.
     */
    suspend fun folders(): List<String>

    fun onEnabledChange(listener: () -> Unit): AutoCloseable
    fun onFoldersChange(listener: () -> Unit): AutoCloseable
}

/** Lists the open documents in the lock; completes once written, or when the hub stops waiting. */
fun interface HubPublisher {
    fun publish(documents: List<String>): CompletableFuture<Unit>
}

/** The document registry's side of the lock: the hub hands it a publisher while it runs. */
interface HubDocuments {
    fun setPublisher(publisher: HubPublisher?)
}

/** The JVM shutdown hooks, so a test can see the one the hub adds and removes. */
interface ShutdownHooks {
    fun add(hook: Thread)

    /** False when the hook was not added, or the JVM is already shutting down. */
    fun remove(hook: Thread): Boolean
}

/** Runtime.getRuntime()'s hooks; a hook left behind would pin the plugin's class loader. */
object RuntimeShutdownHooks : ShutdownHooks {
    override fun add(hook: Thread) = Runtime.getRuntime().addShutdownHook(hook)

    // Runtime throws IllegalStateException once the JVM is shutting down, when the hook runs anyway.
    override fun remove(hook: Thread): Boolean =
        try { Runtime.getRuntime().removeShutdownHook(hook) } catch (e: IllegalStateException) { false }
}
