package com.github.dineug.erdeditorintellijplugin.hub.transport

import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.github.dineug.erdeditorintellijplugin.hub.win.Kernel32Ex
import com.sun.jna.Memory
import com.sun.jna.Native
import com.sun.jna.platform.win32.Kernel32
import com.sun.jna.platform.win32.WinBase
import com.sun.jna.platform.win32.WinError
import com.sun.jna.platform.win32.WinNT
import com.sun.jna.ptr.IntByReference
import java.io.IOException
import java.util.concurrent.CancellationException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.Condition
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * The hub's listener on Windows: a named pipe, the only local socket Node's net.connect dials there,
 * served as libuv serves one. Every handle is overlapped, since a handle opened for synchronous I/O
 * serializes it, and a blocked read would hold every notification back. The default security
 * descriptor, as libuv's: full control for the creating user, SYSTEM and administrators, read-only
 * for everyone else, who then cannot write the hello a peer needs; remote clients are refused.
 */
class NamedPipeListenerFactory(private val io: ExecutorService, private val log: HubLog) : HubListenerFactory {
    override fun listen(pipe: String, onAccept: (HubChannel) -> Unit): HubListener {
        // The first instance claims the name: ERROR_ACCESS_DENIED means another process owns it.
        val first = try {
            NamedPipeWin32.createInstance(pipe, first = true)
        } catch (e: IOException) {
            throw HubListenException(pipe, e)
        }
        val listener = try {
            NamedPipeListener(pipe, first, onAccept, io, log)
        } catch (e: IOException) {
            NamedPipeWin32.closeHandle(first)
            throw HubListenException(pipe, e)
        }
        try {
            io.execute(listener::acceptLoop)
        } catch (e: RejectedExecutionException) {
            listener.finishLoop()
            throw HubListenException(pipe, "The hub's threads have stopped", e)
        }
        return listener
    }
}

/**
 * One instance always waits in ConnectNamedPipe; the next is created as soon as a client connects,
 * so a client that finds every instance busy retries (libuv waits in WaitNamedPipe). Only the accept
 * loop touches the waiting instance, its OVERLAPPED and its events, and it releases them itself.
 */
private class NamedPipeListener(
    override val pipe: String,
    first: WinNT.HANDLE,
    private val onAccept: (HubChannel) -> Unit,
    private val io: ExecutorService,
    private val log: HubLog,
) : HubListener {
    private var waiting: WinNT.HANDLE? = first
    private val events = NamedPipeWin32.createEvents(2)
    private val stopEvent = events[0]
    private val connects = NamedPipeOverlapped(events[1])
    private val lock = ReentrantLock()
    private val channels = HashSet<NamedPipeChannel>()

    @Volatile
    private var closed = false
    private var loopDone = false
    private val loopEnded = CountDownLatch(1)

    fun acceptLoop() {
        try {
            while (!closed) {
                val instance = waiting ?: NamedPipeWin32.createOrLog(pipe, log)
                if (instance == null) {
                    if (pause()) break
                    continue
                }
                waiting = instance
                val failure = try {
                    connect(instance)
                    null
                } catch (e: NamedPipeStopped) {
                    break
                } catch (e: IOException) {
                    e
                }
                if (failure != null) {
                    // A client that left before its connect completed is no failure. Any other is
                    // logged and paused on, so a lasting one neither spins nor floods the log.
                    val gone = failure is NamedPipeGone
                    if (!gone) log.warn("", failure)
                    replaceWaiting(instance)
                    if ((!gone || waiting == null) && pause()) break
                    continue
                }
                waiting = null
                if (closed) {
                    NamedPipeWin32.closeHandle(instance)
                    break
                }
                // The next instance waits before this one is handed over, so the next client finds it.
                waiting = NamedPipeWin32.createOrLog(pipe, log)
                handOver(instance)
                if (waiting == null && pause()) break
            }
        } catch (e: CancellationException) {
            // No failure to log, and no coroutine waits on this task to take it.
        } catch (e: Exception) {
            log.warn("", e)
        } finally {
            finishLoop()
        }
    }

    /** Releases what the loop owns; the stop event only under the lock close signals it under. */
    fun finishLoop() {
        closeWaiting()
        lock.withLock {
            loopDone = true
            connects.free()
            NamedPipeWin32.closeHandle(stopEvent)
        }
        loopEnded.countDown()
    }

    private fun closeWaiting() {
        waiting?.let(NamedPipeWin32::closeHandle)
        waiting = null
    }

    /**
     * Creates the next waiting instance before the failed one closes, so the name never goes missing:
     * a client would get ERROR_FILE_NOT_FOUND meanwhile, and another process could claim the name. A
     * client can connect before ConnectNamedPipe runs, so the fresh instance serves during a pause.
     */
    private fun replaceWaiting(failed: WinNT.HANDLE) {
        waiting = NamedPipeWin32.createOrLog(pipe, log)
        NamedPipeWin32.closeHandle(failed)
    }

    /** True once close asked the loop to stop; the pause a failure takes before the next try. */
    private fun pause(): Boolean =
        NamedPipeWin32.kernel.WaitForSingleObject(stopEvent, ACCEPT_PAUSE_MS) == WinBase.WAIT_OBJECT_0

    private fun connect(instance: WinNT.HANDLE) {
        connects.begin()
        if (NamedPipeWin32.ex.ConnectNamedPipe(instance, connects.overlapped)) return
        when (val error = Native.getLastError()) {
            // A client connected between CreateNamedPipe and ConnectNamedPipe: a good connection.
            WinError.ERROR_PIPE_CONNECTED -> return
            WinError.ERROR_IO_PENDING ->
                NamedPipeWin32.awaitCompletion(instance, connects, stopEvent, "ConnectNamedPipe", pending = true)
            else -> throw NamedPipeWin32.failure("ConnectNamedPipe", error)
        }
    }

    private fun handOver(instance: WinNT.HANDLE) {
        val channel = try {
            NamedPipeChannel(instance, ::forget)
        } catch (e: IOException) {
            NamedPipeWin32.closeHandle(instance)
            log.warn("", e)
            return
        }
        val tracked = lock.withLock { !closed && channels.add(channel) }
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

    private fun serve(channel: NamedPipeChannel) {
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

    private fun forget(channel: NamedPipeChannel) {
        lock.withLock { channels.remove(channel) }
    }

    override fun close() {
        val accepted = lock.withLock {
            if (closed) return
            closed = true
            if (!loopDone) NamedPipeWin32.kernel.SetEvent(stopEvent)
            channels.toList().also { channels.clear() }
        }
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(RELEASE_WAIT_MS)
        accepted.forEach(NamedPipeChannel::signalStop)
        try {
            loopEnded.await(ACCEPT_JOIN_MS, TimeUnit.MILLISECONDS)
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        }
        accepted.forEach { it.awaitRelease(deadline) }
    }

    private companion object {
        const val ACCEPT_PAUSE_MS = 100
        const val ACCEPT_JOIN_MS = 500L
    }
}

/**
 * One end of a connected pipe, the hub's accepted instance or a test's client. A read and a write
 * each own an OVERLAPPED, a manual-reset event and a native buffer, which the kernel may write until
 * the operation completed, so they are freed only after every operation in flight completed: the last
 * thread to leave one after destroy releases the channel. Nothing calls DisconnectNamedPipe, which
 * would discard what the peer has not read yet; closing the handle keeps it readable, then EOF.
 */
internal class NamedPipeChannel(
    private val handle: WinNT.HANDLE,
    private val onRelease: (NamedPipeChannel) -> Unit = {},
) : HubChannel {
    private val events = NamedPipeWin32.createEvents(3)
    private val stopEvent = events[0]
    private val reads = NamedPipeOverlapped(events[1])
    private val writes = NamedPipeOverlapped(events[2])
    private val readBuffer = Memory(BUFFER_BYTES.toLong())
    private val writeBuffer = Memory(BUFFER_BYTES.toLong())
    private val lock = ReentrantLock()
    private val changed: Condition = lock.newCondition()

    // A second reader or writer waits its turn: two operations in flight would share one OVERLAPPED
    // and one native buffer, which the kernel still owns until the first one completed.
    private val readTurn = ReentrantLock()
    private val writeTurn = ReentrantLock()

    // Guarded by lock: threads inside an operation, a write() in progress, destroy asked, released.
    private var users = 0
    private var writing = false
    private var stopping = false
    private var released = false

    @Volatile
    private var outputEnded = false

    @Volatile
    private var readEnded = false

    override fun read(buffer: ByteArray): Int {
        if (buffer.isEmpty()) return 0
        readTurn.withLock {
            while (true) {
                if (readEnded) return -1
                val count = try {
                    readOnce(buffer)
                } catch (e: NamedPipeGone) {
                    readEnded = true
                    return -1
                }
                if (count > 0) return count
            }
        }
    }

    private fun readOnce(into: ByteArray): Int {
        if (!enter()) throw IOException("The pipe is closed")
        try {
            val size = minOf(into.size, BUFFER_BYTES)
            reads.begin()
            val pending = NamedPipeWin32.started(
                NamedPipeWin32.ex.ReadFile(handle, readBuffer, size, null, reads.overlapped), "ReadFile",
            )
            val count = NamedPipeWin32.awaitCompletion(handle, reads, stopEvent, "ReadFile", pending)
            readBuffer.read(0, into, 0, count)
            return count
        } finally {
            exit()
        }
    }

    override fun write(bytes: ByteArray) {
        writeTurn.withLock {
            lock.withLock {
                if (outputEnded || readEnded || stopping) return
                writing = true
            }
            try {
                var offset = 0
                while (offset < bytes.size) {
                    val sent = writeOnce(bytes, offset, minOf(BUFFER_BYTES, bytes.size - offset)) ?: return
                    if (sent == 0) throw IOException("WriteFile completed without writing")
                    offset += sent
                }
            } finally {
                lock.withLock {
                    writing = false
                    changed.signalAll()
                }
            }
        }
    }

    /** The bytes one WriteFile took, or null when destroy cancelled it: the rest is dropped. */
    private fun writeOnce(bytes: ByteArray, offset: Int, size: Int): Int? {
        if (!enter()) return null
        try {
            writeBuffer.write(0, bytes, offset, size)
            writes.begin()
            val pending = NamedPipeWin32.started(
                NamedPipeWin32.ex.WriteFile(handle, writeBuffer, size, null, writes.overlapped), "WriteFile",
            )
            return NamedPipeWin32.awaitCompletion(handle, writes, stopEvent, "WriteFile", pending)
        } catch (e: NamedPipeStopped) {
            return null
        } finally {
            exit()
        }
    }

    /**
     * No half-close exists on a pipe, and FlushFileBuffers blocks until the peer read everything and
     * cannot be cancelled. So a write in progress gets a second to finish, then the channel closes as
     * destroy does; the peer reads what was written, then ERROR_BROKEN_PIPE, its EOF.
     */
    override fun shutdownOutput() {
        lock.withLock {
            outputEnded = true
            val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(WRITE_FINISH_MS)
            while (writing && !stopping && awaitChange(deadline)) continue
        }
        destroy()
    }

    override fun destroy() {
        signalStop()
        awaitRelease(System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(RELEASE_WAIT_MS))
    }

    override fun close() = destroy()

    /** Destroy's first half, which never waits: no new operation, the stop event set, every pending one cancelled. */
    fun signalStop() {
        val releasedNow = lock.withLock {
            outputEnded = true
            if (stopping) return
            stopping = true
            NamedPipeWin32.kernel.SetEvent(stopEvent)
            NamedPipeWin32.ex.CancelIoEx(handle, null)
            users == 0 && releaseLocked()
        }
        if (releasedNow) onRelease(this)
    }

    /**
     * Destroy's second half: waits until the last operation completed and the channel was released,
     * or until deadlineNanos. A cancelled operation completes at once, so the bound only guards a
     * thread that never returns; that thread then releases the channel when it does.
     */
    fun awaitRelease(deadlineNanos: Long) {
        lock.withLock {
            while (!released && awaitChange(deadlineNanos)) continue
        }
    }

    private fun enter(): Boolean = lock.withLock {
        if (stopping) return false
        users++
        true
    }

    private fun exit() {
        val releasedNow = lock.withLock {
            users--
            changed.signalAll()
            users == 0 && stopping && releaseLocked()
        }
        if (releasedNow) onRelease(this)
    }

    private fun releaseLocked(): Boolean {
        if (released) return false
        released = true
        NamedPipeWin32.closeHandle(handle)
        NamedPipeWin32.closeHandle(stopEvent)
        reads.free()
        writes.free()
        readBuffer.close()
        writeBuffer.close()
        changed.signalAll()
        return true
    }

    /** Waits for a change under lock until deadlineNanos; false once it passed or the thread was interrupted. */
    private fun awaitChange(deadlineNanos: Long): Boolean {
        val left = deadlineNanos - System.nanoTime()
        if (left <= 0) return false
        return try {
            changed.awaitNanos(left)
            true
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            false
        }
    }

    private companion object {
        const val BUFFER_BYTES = 64 * 1024
        const val WRITE_FINISH_MS = 1_000L
    }
}

/** An operation's OVERLAPPED in native memory, with the manual-reset event it signals. */
internal class NamedPipeOverlapped(val event: WinNT.HANDLE) {
    val overlapped = Memory(NamedPipeWin32.OVERLAPPED_BYTES)
    val transferred = IntByReference()

    init {
        overlapped.clear()
        overlapped.setPointer(NamedPipeWin32.EVENT_OFFSET, event.pointer)
    }

    /** Zeroes every field but hEvent and resets the event, as a new operation needs. */
    fun begin() {
        overlapped.setMemory(0, NamedPipeWin32.EVENT_OFFSET, 0)
        NamedPipeWin32.kernel.ResetEvent(event)
    }

    fun free() {
        overlapped.close()
        NamedPipeWin32.closeHandle(event)
    }
}

/** The pipe's other end closed it (EOF for a read, a failure for a write). */
internal class NamedPipeGone(call: String, error: Int) :
    IOException("$call failed with Windows error $error: the other end closed the pipe")

/** destroy cancelled the operation (ERROR_OPERATION_ABORTED). */
internal class NamedPipeStopped(call: String) : IOException("$call was cancelled: the pipe is closing")

/** The Win32 calls, on Windows only: nothing here loads before a named pipe listens or connects. */
internal object NamedPipeWin32 {
    val kernel: Kernel32 get() = Kernel32.INSTANCE
    val ex: Kernel32Ex get() = Kernel32Ex.INSTANCE

    /** hEvent follows Internal and InternalHigh (ULONG_PTR each) and the 8-byte Offset union. */
    val EVENT_OFFSET: Long = 2L * Native.POINTER_SIZE + 8
    val OVERLAPPED_BYTES: Long = EVENT_OFFSET + Native.POINTER_SIZE

    private const val BUFFER_BYTES = 64 * 1024
    private const val OPEN_MODE = WinBase.PIPE_ACCESS_DUPLEX or WinNT.FILE_FLAG_OVERLAPPED
    private const val PIPE_MODE =
        WinBase.PIPE_TYPE_BYTE or WinBase.PIPE_READMODE_BYTE or WinBase.PIPE_WAIT or WinBase.PIPE_REJECT_REMOTE_CLIENTS

    fun createInstance(pipe: String, first: Boolean): WinNT.HANDLE {
        val mode = if (first) OPEN_MODE or Kernel32Ex.FILE_FLAG_FIRST_PIPE_INSTANCE else OPEN_MODE
        val handle = kernel.CreateNamedPipe(
            pipe, mode, PIPE_MODE, WinBase.PIPE_UNLIMITED_INSTANCES, BUFFER_BYTES, BUFFER_BYTES, 0, null,
        )
        if (handle == null || handle == WinBase.INVALID_HANDLE_VALUE) {
            throw failure("CreateNamedPipe", Native.getLastError())
        }
        return handle
    }

    fun createOrLog(pipe: String, log: HubLog): WinNT.HANDLE? = try {
        createInstance(pipe, first = false)
    } catch (e: IOException) {
        log.warn("", e)
        null
    }

    /** Manual-reset events, unsignaled, as overlapped I/O needs: a wait must not consume the completion. */
    fun createEvents(count: Int): List<WinNT.HANDLE> {
        val events = ArrayList<WinNT.HANDLE>(count)
        repeat(count) {
            val event = kernel.CreateEvent(null, true, false, null)
            if (event == null) {
                val error = Native.getLastError()
                events.forEach(::closeHandle)
                throw failure("CreateEvent", error)
            }
            events += event
        }
        return events
    }

    fun closeHandle(handle: WinNT.HANDLE) {
        kernel.CloseHandle(handle)
    }

    /**
     * After ReadFile or WriteFile: true when the operation went pending, false when it completed at
     * once; a call that did neither failed.
     */
    fun started(completed: Boolean, call: String): Boolean {
        if (completed) return false
        val error = Native.getLastError()
        if (error != WinError.ERROR_IO_PENDING) throw failure(call, error)
        return true
    }

    /**
     * Waits out a pending operation, or the stop event. After a stop the operation is cancelled and
     * still waited for, since CancelIoEx does not wait and the kernel owns the OVERLAPPED and the
     * buffer until it completed. GetOverlappedResult waits only while the operation is pending, so an
     * operation that completed at once reads its count without a wait. The bytes it transferred.
     */
    fun awaitCompletion(
        handle: WinNT.HANDLE, op: NamedPipeOverlapped, stopEvent: WinNT.HANDLE, call: String, pending: Boolean,
    ): Int {
        val signaled = if (pending) {
            kernel.WaitForMultipleObjects(2, arrayOf(op.event, stopEvent), false, WinBase.INFINITE)
        } else {
            WinBase.WAIT_OBJECT_0
        }
        val waitError = Native.getLastError()
        if (signaled != WinBase.WAIT_OBJECT_0) ex.CancelIoEx(handle, op.overlapped)
        val completed = ex.GetOverlappedResult(handle, op.overlapped, op.transferred, true)
        val error = Native.getLastError()
        if (signaled == WinBase.WAIT_FAILED) throw failure("WaitForMultipleObjects", waitError)
        if (!completed) throw failure(call, error)
        return op.transferred.value
    }

    fun failure(call: String, error: Int): IOException = when (error) {
        WinError.ERROR_BROKEN_PIPE, WinError.ERROR_PIPE_NOT_CONNECTED, WinError.ERROR_NO_DATA ->
            NamedPipeGone(call, error)
        WinError.ERROR_OPERATION_ABORTED -> NamedPipeStopped(call)
        WinError.ERROR_ACCESS_DENIED ->
            IOException("$call failed with Windows error $error: access denied, the pipe name is taken")
        else -> IOException("$call failed with Windows error $error")
    }
}

private const val RELEASE_WAIT_MS = 1_000L
