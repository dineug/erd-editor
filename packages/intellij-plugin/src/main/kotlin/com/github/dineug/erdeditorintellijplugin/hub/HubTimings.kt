package com.github.dineug.erdeditorintellijplugin.hub

/**
 * Every wait and bound of the hub, in milliseconds, with the production values as defaults. Tests
 * shorten them; the texts that name a wait keep the production numbers (5000, 2000, within 1 second).
 */
data class HubTimings(
    val publishWaitMs: Long = 1_000, // PUBLISH_WAIT
    val initialValueHoldMs: Long = 1_000, // how long an editor holds its initial value for the lock
    val joinQuietCapMs: Long = 500, // JOIN_QUIET_CAP_MS
    val saveQuietCapMs: Long = 2_000, // SAVE_QUIET_CAP_MS
    val openReadyTimeoutMs: Long = 5_000, // OPEN_READY_TIMEOUT_MS
    val replicaDebounceMs: Long = 200, // REPLICA_DEBOUNCE_MS
    val drainCapMs: Long = 1_000, // DRAIN_CAP_MS
    val closeBoundMs: Long = 1_000, // the bounded wait for the running lock task on close
    val registryCallBoundMs: Long = 500, // a blocking registry call from the EDT
    val threadJoinBoundMs: Long = 500,
    val saveWriteBoundMs: Long = 10_000, // save's write through the EDT, then {"saved":false}
    val foldersDebounceMs: Long = 200, // coalesces rootsChanged storms
    val lockRenameDelaysMs: List<Long> = listOf(10, 20, 40, 80, 160), // RENAME_BACKOFF doubling, RENAME_RETRIES times
    val lockRepairMs: Long = 1_000, // LOCK_REPAIR_MS
    val lockRepairMaxMs: Long = 30_000, // LOCK_REPAIR_MAX_MS
)
