package com.github.dineug.erdeditorintellijplugin.hub.server

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The hub removes its shutdown hook on dispose: a hook left behind would pin the plugin's class loader. */
class RuntimeShutdownHooksTest {

    @Test
    fun `removes a hook it added once`() {
        val hook = Thread {}
        RuntimeShutdownHooks.add(hook)
        assertTrue(RuntimeShutdownHooks.remove(hook))
        assertFalse(RuntimeShutdownHooks.remove(hook))
    }
}
