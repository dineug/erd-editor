package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.server.ShutdownHooks
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Shutdown hooks that are only recorded, never handed to the JVM, so a suite can see the hook a
 * runtime adds and removes, and run it by hand as a JVM going down would. throwOnAdd and
 * throwOnRemove make the next call throw, as Runtime does once the JVM is shutting down.
 */
class RecordingHooks : ShutdownHooks {
    private val addedHooks = CopyOnWriteArrayList<Thread>()
    private val removedHooks = CopyOnWriteArrayList<Thread>()
    private val registered = CopyOnWriteArrayList<Thread>()

    /** Every hook added, in order. */
    val added: List<Thread> get() = addedHooks.toList()

    /** Every hook a removal was asked for, in order, whether or not it was registered. */
    val removed: List<Thread> get() = removedHooks.toList()

    /** The hooks added and not removed since: what a JVM going down now would run. */
    val active: List<Thread> get() = registered.toList()

    /** Thrown by the next remove, once, after it was recorded. */
    @Volatile
    var throwOnRemove: RuntimeException? = null

    /** Thrown by the next add, once, before anything is recorded. */
    @Volatile
    var throwOnAdd: RuntimeException? = null

    override fun add(hook: Thread) {
        throwOnAdd?.let {
            throwOnAdd = null
            throw it
        }
        addedHooks += hook
        registered += hook
    }

    override fun remove(hook: Thread): Boolean {
        removedHooks += hook
        throwOnRemove?.let {
            throwOnRemove = null
            throw it
        }
        return registered.remove(hook)
    }
}
