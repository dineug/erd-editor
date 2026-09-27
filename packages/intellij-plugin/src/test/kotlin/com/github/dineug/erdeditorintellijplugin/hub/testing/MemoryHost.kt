package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.server.HubHost
import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger

/**
 * A host double, as agent-hub-host's createMemoryHost: set enabled or roots, then fire the matching
 * event, as a host does once its own state changed. throwOnEnabled and throwOnFolders make the next
 * call throw; foldersGate holds folders() suspended until completed, as a read action waits.
 */
class MemoryHost(
    override val ide: String = "memory-ide",
    enabled: Boolean = true,
    roots: List<String> = emptyList(),
) : HubHost {
    @Volatile
    var enabled: Boolean = enabled

    @Volatile
    var roots: List<String> = roots

    /** Thrown by the next isEnabled, once. */
    @Volatile
    var throwOnEnabled: Throwable? = null

    /** Thrown by the next folders, once. */
    @Volatile
    var throwOnFolders: Throwable? = null

    /** When set, folders() awaits it before it answers; a cancelled caller unwinds there. */
    @Volatile
    var foldersGate: CompletableDeferred<Unit>? = null

    /** Calls of folders() that reached the gate, whether or not they passed it. */
    val foldersCalls: AtomicInteger = AtomicInteger()

    /** Unsubscribing throws this, as a host whose bus already went down might. */
    @Volatile
    var throwOnUnsubscribe: Exception? = null

    private val enabledListeners = CopyOnWriteArrayList<() -> Unit>()
    private val folderListeners = CopyOnWriteArrayList<() -> Unit>()

    override fun isEnabled(): Boolean {
        throwOnEnabled?.let {
            throwOnEnabled = null
            throw it
        }
        return enabled
    }

    override suspend fun folders(): List<String> {
        foldersCalls.incrementAndGet()
        foldersGate?.await()
        throwOnFolders?.let {
            throwOnFolders = null
            throw it
        }
        return roots
    }

    override fun onEnabledChange(listener: () -> Unit): AutoCloseable = subscribe(enabledListeners, listener)

    override fun onFoldersChange(listener: () -> Unit): AutoCloseable = subscribe(folderListeners, listener)

    fun fireEnabledChange() {
        enabledListeners.forEach { it() }
    }

    fun fireFoldersChange() {
        folderListeners.forEach { it() }
    }

    /** Sets enabled, then fires, as a settings change does. */
    fun turn(enabled: Boolean) {
        this.enabled = enabled
        fireEnabledChange()
    }

    /** The listeners the hub still holds. */
    val subscriptions: Int get() = enabledListeners.size + folderListeners.size

    private fun subscribe(listeners: MutableList<() -> Unit>, listener: () -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable {
            listeners -= listener
            throwOnUnsubscribe?.let { throw it }
        }
    }
}
