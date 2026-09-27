package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.HubClock

/** A HubClock that stands still until a test sets or advances it, for the join window's timestamps. */
class FakeClock(start: Double = 0.0) : HubClock {
    @Volatile
    var now: Double = start

    override fun nowMs(): Double = now

    fun advance(ms: Double) {
        now += ms
    }
}
