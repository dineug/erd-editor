package com.github.dineug.erdeditorintellijplugin.hub.transport

import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import java.io.Closeable
import java.io.IOException
import java.net.StandardProtocolFamily
import java.net.UnixDomainSocketAddress
import java.nio.ByteBuffer
import java.nio.channels.ClosedChannelException
import java.nio.channels.ServerSocketChannel
import java.nio.channels.SocketChannel
import java.nio.file.InvalidPathException
import java.nio.file.Path
import java.util.concurrent.CancellationException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The hub's listener on macOS and Linux: a unix domain socket at the lock's pipe path. It never
 * removes the socket file. The JDK refuses to bind over a file and leaves its own after close, where
 * Node's server unlinks it, so DocumentHub, the one owner of the path, deletes it before it listens
 * and after it stops. The JDK throws on a path longer than sun_path where Node truncates;
 * LockPaths.pipePathFits keeps the hub from handing out such a path, and a bind that fails anyway is
 * a HubListenException.
 */
class UnixSocketListenerFactory internal constructor(
    private val io: ExecutorService,
    private val log: HubLog,
    private val accept: (ServerSocketChannel) -> SocketChannel,
) : HubListenerFactory {
    constructor(io: ExecutorService, log: HubLog) : this(io, log, ServerSocketChannel::accept)

    override fun listen(pipe: String, onAccept: (HubChannel) -> Unit): HubListener {
        val path = try {
            Path.of(pipe)
        } catch (e: InvalidPathException) {
            throw HubListenException(pipe, e)
        }
        val server = try {
            bind(path)
        } catch (e: IOException) {
            throw HubListenException(pipe, e)
        }
        val listener = UnixSocketListener(pipe, server, onAccept)
        try {
            io.execute(listener::acceptLoop)
        } catch (e: RejectedExecutionException) {
            closeQuietly(server)
            throw HubListenException(pipe, "The hub's threads have stopped", e)
        }
        return listener
    }

    private fun bind(path: Path): ServerSocketChannel {
        val server = ServerSocketChannel.open(StandardProtocolFamily.UNIX)
        try {
            server.bind(UnixDomainSocketAddress.of(path))
        } catch (e: IOException) {
            closeQuietly(server)
            throw e
        }
        return server
    }

    private inner class UnixSocketListener(
        override val pipe: String,
        private val server: ServerSocketChannel,
        private val onAccept: (HubChannel) -> Unit,
    ) : HubListener {
        private val channels = HashSet<UnixSocketChannel>()

        // Written under channels' monitor, so no channel is tracked after close took its snapshot.
        @Volatile
        private var closed = false
        private val stopped = CountDownLatch(1)
        private val loopEnded = CountDownLatch(1)

        fun acceptLoop() {
            try {
                while (true) {
                    val socket = try {
                        accept(server)
                    } catch (e: ClosedChannelException) {
                        return
                    } catch (e: IOException) {
                        if (closed) return
                        // A failure that lasts, such as running out of descriptors, must neither spin
                        // nor flood the log.
                        log.warn("", e)
                        if (stopped.await(ACCEPT_PAUSE_MS, TimeUnit.MILLISECONDS)) return
                        continue
                    }
                    handOver(socket)
                }
            } catch (e: InterruptedException) {
                // The hub's threads are shutting down: accepting is over, and close cleans up.
            } finally {
                loopEnded.countDown()
            }
        }

        private fun handOver(socket: SocketChannel) {
            val channel = UnixSocketChannel(socket, ::forget)
            val tracked = synchronized(channels) { !closed && channels.add(channel) }
            if (!tracked) {
                channel.destroy()
                return
            }
            try {
                io.execute { serve(channel) }
            } catch (e: RejectedExecutionException) {
                channel.destroy()
            }
        }

        private fun serve(channel: UnixSocketChannel) {
            try {
                onAccept(channel)
            } catch (e: CancellationException) {
                // A cancelled start is no failure to log, and no coroutine waits on this task to take it.
                channel.destroy()
            } catch (e: Exception) {
                log.warn("", e)
                channel.destroy()
            }
        }

        private fun forget(channel: UnixSocketChannel) {
            synchronized(channels) { channels.remove(channel) }
        }

        override fun close() {
            val accepted = synchronized(channels) {
                if (closed) return
                closed = true
                channels.toList().also { channels.clear() }
            }
            stopped.countDown()
            closeQuietly(server)
            accepted.forEach(UnixSocketChannel::destroy)
            try {
                loopEnded.await(ACCEPT_JOIN_MS, TimeUnit.MILLISECONDS)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
            }
        }
    }

    private companion object {
        const val ACCEPT_PAUSE_MS = 100L
        const val ACCEPT_JOIN_MS = 500L
    }
}

/** The hub's side of an accepted unix socket. */
internal class UnixSocketChannel(
    private val socket: SocketChannel,
    private val onRelease: (UnixSocketChannel) -> Unit,
) : HubChannel {
    @Volatile
    private var outputEnded = false

    @Volatile
    private var readEnded = false
    private val released = AtomicBoolean()

    override fun read(buffer: ByteArray): Int {
        val count = socket.read(ByteBuffer.wrap(buffer))
        if (count < 0) readEnded = true
        return count
    }

    override fun write(bytes: ByteArray) {
        if (outputEnded || readEnded) return
        val buffer = ByteBuffer.wrap(bytes)
        try {
            while (buffer.hasRemaining()) socket.write(buffer)
        } catch (e: ClosedChannelException) {
            // Destroyed from another thread mid-write: the rest is dropped. An interrupt of this
            // thread closes the channel too, and that is a failure.
            if (!outputEnded) throw e
        }
    }

    override fun shutdownOutput() {
        outputEnded = true
        try {
            socket.shutdownOutput()
        } catch (e: IOException) {
            // Closed or reset already: there is no stream left to end.
        }
    }

    override fun destroy() = close()

    override fun close() {
        outputEnded = true
        if (!released.compareAndSet(false, true)) return
        closeQuietly(socket)
        onRelease(this)
    }
}

private fun closeQuietly(closeable: Closeable) {
    try {
        closeable.close()
    } catch (e: IOException) {
        // A descriptor the kernel failed to close is gone for this process all the same.
    }
}
