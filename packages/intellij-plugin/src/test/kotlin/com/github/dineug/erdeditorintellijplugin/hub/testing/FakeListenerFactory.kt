package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.transport.HubChannel
import com.github.dineug.erdeditorintellijplugin.hub.transport.HubListenException
import com.github.dineug.erdeditorintellijplugin.hub.transport.HubListener
import com.github.dineug.erdeditorintellijplugin.hub.transport.HubListenerFactory
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The listener the lifecycle suites run the hub on, over the fake file system, as agent-hub-host's
 * createMemoryHub listens: a pipe already bound, or with a file at its path, fails EADDRINUSE, one
 * whose directory is missing ENOENT; a socket path gets a file, which, like the JDK's, stays after
 * close. connect hands the hub a MemoryChannel. onListen and onClose see the state at each call.
 */
class FakeListenerFactory(private val env: FakeEnvironment) : HubListenerFactory {
    /** A listen held until the test releases it, as a bind stalled by the system. */
    class ListenHold internal constructor() {
        private val entered = CountDownLatch(1)
        private val released = CountDownLatch(1)

        fun awaitEntered(timeoutMs: Long = 5_000) {
            if (!entered.await(timeoutMs, TimeUnit.MILLISECONDS)) throw AssertionError("no listen within $timeoutMs ms")
        }

        fun release() {
            released.countDown()
        }

        internal fun block() {
            entered.countDown()
            if (!released.await(FakeFileSystem.HOLD_CAP_MS, TimeUnit.MILLISECONDS)) {
                throw HubListenException("", "the listen was held and never released")
            }
        }
    }

    private val servers = ConcurrentHashMap<String, FakeListener>()
    private val failures = ConcurrentLinkedQueue<String>()
    private val holds = ConcurrentLinkedQueue<ListenHold>()
    private val listened = CopyOnWriteArrayList<String>()
    private val closed = CopyOnWriteArrayList<String>()

    /** Runs as a listen starts, before it binds. */
    @Volatile
    var onListen: (String) -> Unit = {}

    /** Runs as a listener closes, before it hangs up its peers. */
    @Volatile
    var onClose: (String) -> Unit = {}

    /** Every pipe the hub asked to listen on, in order, failed ones included. */
    val listens: List<String> get() = listened.toList()

    /** Every pipe whose listener closed, in order. */
    val closes: List<String> get() = closed.toList()

    /** The pipes listening now. */
    val listening: Set<String> get() = servers.keys.toSet()

    /** The next listen fails with message, as binding a pipe already bound does. */
    fun failListenOnce(message: String = "EADDRINUSE") {
        failures += message
    }

    /** The next listen waits, once recorded, until the returned hold is released. */
    fun holdListen(): ListenHold = ListenHold().also { holds += it }

    override fun listen(pipe: String, onAccept: (HubChannel) -> Unit): HubListener {
        listened += pipe
        onListen(pipe)
        holds.poll()?.block()
        failures.poll()?.let { throw HubListenException(pipe, it) }
        if (servers.containsKey(pipe) || env.fs.exists(pipe)) throw HubListenException(pipe, "EADDRINUSE: $pipe")
        if (!pipe.startsWith(NAMED_PIPE_PREFIX)) {
            if (!env.fs.isDirectory(FakeFileSystem.parentOf(pipe))) throw HubListenException(pipe, "ENOENT: $pipe")
            env.fs.addFile(pipe)
        }
        return FakeListener(pipe, onAccept).also { servers[pipe] = it }
    }

    /** Connects a peer to the pipe listening, or to the one given; the hub starts serving it at once. */
    fun connect(pipe: String = servers.keys.single()): MemoryChannel {
        val listener = servers[pipe] ?: throw IOException("ECONNREFUSED: $pipe")
        return MemoryChannel().also(listener::accept)
    }

    private inner class FakeListener(override val pipe: String, private val onAccept: (HubChannel) -> Unit) : HubListener {
        private val channels = CopyOnWriteArrayList<MemoryChannel>()

        @Volatile
        private var stopped = false

        fun accept(channel: MemoryChannel) {
            channels += channel
            onAccept(channel)
        }

        override fun close() {
            if (stopped) return
            stopped = true
            closed += pipe
            onClose(pipe)
            servers.remove(pipe)
            channels.forEach(MemoryChannel::destroy)
        }
    }

    private companion object {
        const val NAMED_PIPE_PREFIX = "\\\\.\\pipe\\"
    }
}
