package com.github.dineug.erdeditorintellijplugin.hub.transport

import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.util.concurrent.Executors

/** Node's net.connect dials a named pipe on Windows and a unix socket everywhere else; so does the hub listen. */
class PlatformListenerFactoryTest {

    @Test
    fun `picks a named pipe on Windows and a unix socket everywhere else, constructing nothing native`() {
        val io = Executors.newSingleThreadExecutor()
        try {
            val log = RecordingLog()
            assertTrue(platformListenerFactory(HubPlatform.WIN32, io, log) is NamedPipeListenerFactory)
            for (platform in listOf(HubPlatform.DARWIN, HubPlatform.LINUX, HubPlatform.OTHER)) {
                assertTrue(platform.node, platformListenerFactory(platform, io, log) is UnixSocketListenerFactory)
            }
        } finally {
            io.shutdownNow()
        }
    }

    @Test
    fun `names the pipe a listen failed on`() {
        val cause = IOException("Address already in use")
        val error = HubListenException("/tmp/erd-editor-ide-1.sock", "Address already in use", cause)
        assertEquals("/tmp/erd-editor-ide-1.sock", error.pipe)
        assertEquals("Address already in use", error.message)
        assertSame(cause, error.cause)
        assertNull(HubListenException("/tmp/erd-editor-ide-1.sock", "refused").cause)

        assertEquals("Address already in use", HubListenException("/tmp/erd-editor-ide-1.sock", cause).message)
        val silent = IOException()
        val named = HubListenException("/tmp/erd-editor-ide-1.sock", silent)
        assertEquals("java.io.IOException", named.message)
        assertSame(silent, named.cause)
    }
}
