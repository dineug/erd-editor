package com.github.dineug.erdeditorintellijplugin.hub.transport

import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import java.io.IOException
import java.util.concurrent.ExecutorService

/**
 * One accepted duplex byte stream. read and write block; destroy unblocks both from any thread.
 * One thread reads and one writes at a time; shutdownOutput, destroy and close never throw. On a
 * named pipe they block while cancelled I/O completes, destroy and close up to 1 s, shutdownOutput
 * up to 2 s, so an io thread calls them, never the registry thread.
 */
interface HubChannel {
    /** Bytes read, -1 at EOF and at every read after it; IOException on an error or after destroy. */
    fun read(buffer: ByteArray): Int

    /**
     * The whole array, or IOException. Once the output ended or the peer's EOF was read, the bytes
     * are dropped without an error, as Node drops a write to a socket it destroyed or ended, and it
     * ends a socket whose peer ended (allowHalfOpen false).
     */
    fun write(bytes: ByteArray)

    /**
     * Graceful end after the last write: a FIN on a unix socket, whose reader keeps reading until the
     * peer's EOF; a named pipe cannot half-close, so it closes as destroy does.
     */
    fun shutdownOutput()

    /** Close now; bytes already written stay readable by the peer on both transports. */
    fun destroy()

    /** Releases the channel once reading and writing ended. */
    fun close()
}

/** The listener could not bind [pipe]; the hub then writes a hub false lock. */
class HubListenException(val pipe: String, message: String, cause: Throwable? = null) : IOException(message, cause) {
    /** Says what cause says, or names its class when it says nothing. */
    constructor(pipe: String, cause: Exception) : this(pipe, cause.message ?: cause.toString(), cause)
}

interface HubListener {
    val pipe: String

    /** Stops accepting, destroys every accepted channel, joins the accept work; blocks up to 1 s. */
    fun close()
}

fun interface HubListenerFactory {
    /** Binds pipe or throws HubListenException; onAccept runs on an io thread per accepted channel. */
    fun listen(pipe: String, onAccept: (HubChannel) -> Unit): HubListener
}

/** A named pipe on Windows, which is all Node's net.connect dials there; a unix socket elsewhere. */
fun platformListenerFactory(platform: HubPlatform, io: ExecutorService, log: HubLog): HubListenerFactory =
    if (platform.isWindows) NamedPipeListenerFactory(io, log) else UnixSocketListenerFactory(io, log)
