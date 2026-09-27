package com.github.dineug.erdeditorintellijplugin.hub.testing

/**
 * Polls [condition] until it holds, failing with [message] after [timeoutMs]. The hub runs on real
 * threads and real time, so a suite waits for what it asserts instead of sleeping a guessed span.
 */
fun awaitUntil(timeoutMs: Long = 5_000, message: String = "the awaited condition", condition: () -> Boolean) {
    val deadline = System.nanoTime() + timeoutMs * 1_000_000
    while (!condition()) {
        if (System.nanoTime() - deadline > 0) throw AssertionError("$message did not hold within $timeoutMs ms")
        Thread.sleep(POLL_MS)
    }
}

private const val POLL_MS = 5L
