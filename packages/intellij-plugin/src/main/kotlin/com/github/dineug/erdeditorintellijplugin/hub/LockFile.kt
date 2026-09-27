package com.github.dineug.erdeditorintellijplugin.hub

import java.nio.file.AccessDeniedException
import java.nio.file.FileSystemException

/**
 * What Windows throws for a move over a file any process holds open, whatever its share mode:
 * AccessDeniedException for a held target, a plain FileSystemException for a held source, whose
 * reason is localized, so only the class tells. The twin of lockFile.ts's isBusyReplace.
 */
internal fun refusedWhileHeld(e: FileSystemException): Boolean =
    e is AccessDeniedException || e.javaClass == FileSystemException::class.java

/**
 * This process's lock file under the home's lock directory, and the startup sweep of dead
 * processes' locks, as packages/agent-hub-host's lockFile.ts. The caller creates the directory;
 * a write into a missing one fails and logs. On Windows a refused move waits out each of
 * [renameDelaysMs] through [pause], the hub's registry timer, before it goes again.
 */
class LockFile(
    private val env: HubEnvironment,
    private val log: HubLog,
    private val renameDelaysMs: List<Long> = emptyList(),
    private val pause: (suspend (Long) -> Unit)? = null,
) {
    val lockDir: String = LockPaths.lockDirPath(env.homeDir)
    val lockPath: String = LockPaths.lockFilePath(env.homeDir, env.pid)
    val tempPath: String = LockPaths.lockTempPath(env.homeDir, env.pid)

    /**
     * Writes the temp file with LOCK_FILE_MODE, then renames it over the lock: a rename keeps the
     * source's mode, so the lock is never readable by others. A leftover temp goes first, since one
     * written over would keep its old mode. False, after a log line, when the write or rename failed.
     */
    suspend fun write(record: LockRecord): Boolean {
        quietly { env.fs.deleteIfExists(tempPath) }
        return try {
            env.fs.writeNewFile(tempPath, serializeLock(record), LockPaths.LOCK_FILE_MODE)
            moveOver()
            true
        } catch (e: Exception) {
            e.rethrowIfCancellation()
            log.warn("could not write $lockPath", e)
            false
        }
    }

    /** The rename, tried again after each delay while Windows refuses it for a held lock; the last failure throws. */
    private suspend fun moveOver() {
        for (delayMs in renameDelaysMs) {
            try {
                env.fs.moveReplacing(tempPath, lockPath)
                return
            } catch (e: FileSystemException) {
                if (!env.platform.isWindows || !refusedWhileHeld(e)) throw e
            }
            pause?.invoke(delayMs)
        }
        env.fs.moveReplacing(tempPath, lockPath)
    }

    /** Deletes the lock, then its temp file; each error is ignored. */
    fun remove() {
        quietly { env.fs.deleteIfExists(lockPath) }
        quietly { env.fs.deleteIfExists(tempPath) }
    }

    /** The same two, synchronously and never throwing, for a process going down unawaited. */
    fun removeSync() {
        env.removeFileSync(lockPath)
        env.removeFileSync(tempPath)
    }

    /**
     * Deletes the lock, temp file and every socket path of each other process whose pid is dead. A
     * live pid's lock stays, even a malformed one, which may be mid-write or from a newer schema; a
     * lock that went away between the listing and its read is skipped. Silent on every failure.
     */
    fun cleanStale() {
        try {
            val names = env.fs.listNames(lockDir) ?: return
            val pids = names.mapNotNull(LockPaths::lockFilePid).filter { it != env.pid && readable(it) }
            for (pid in pids) {
                if (env.isAlive(pid)) continue
                quietly { env.fs.deleteIfExists(LockPaths.lockFilePath(env.homeDir, pid)) }
                quietly { env.fs.deleteIfExists(LockPaths.lockTempPath(env.homeDir, pid)) }
                for (socket in LockPaths.socketFilePaths(env.homeDir, env.tmpDir, pid, env.platform)) {
                    quietly { env.fs.deleteIfExists(socket) }
                }
            }
        } catch (e: Exception) {
            e.rethrowIfCancellation()
        }
    }

    /** Whether the lock's text and mtime both read, as discovery reads a lock before it judges it. */
    private fun readable(pid: Long): Boolean {
        val lock = LockPaths.lockFilePath(env.homeDir, pid)
        return try {
            env.fs.readText(lock)
            env.fs.mtimeMs(lock)
            true
        } catch (e: Exception) {
            e.rethrowIfCancellation()
            false
        }
    }

    private fun quietly(block: () -> Unit) {
        try {
            block()
        } catch (e: Exception) {
            e.rethrowIfCancellation()
        }
    }
}
