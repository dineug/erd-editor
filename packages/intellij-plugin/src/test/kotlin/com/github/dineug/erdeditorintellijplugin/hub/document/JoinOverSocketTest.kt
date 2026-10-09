package com.github.dineug.erdeditorintellijplugin.hub.document

import com.github.dineug.erdeditorintellijplugin.hub.HubJson
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.HubRuntime
import com.github.dineug.erdeditorintellijplugin.hub.LockPaths
import com.github.dineug.erdeditorintellijplugin.hub.LockRecord
import com.github.dineug.erdeditorintellijplugin.hub.MachineEnvironment
import com.github.dineug.erdeditorintellijplugin.hub.RealPathResult
import com.github.dineug.erdeditorintellijplugin.hub.parseLock
import com.github.dineug.erdeditorintellijplugin.hub.server.ServeOptions
import com.github.dineug.erdeditorintellijplugin.hub.server.ServedConnection
import com.github.dineug.erdeditorintellijplugin.hub.server.serveConnection
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeDocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeIdeFacade
import com.github.dineug.erdeditorintellijplugin.hub.testing.FakeView
import com.github.dineug.erdeditorintellijplugin.hub.testing.MemoryHost
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingHooks
import com.github.dineug.erdeditorintellijplugin.hub.testing.RecordingLog
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestPeer
import com.github.dineug.erdeditorintellijplugin.hub.testing.TestThreads
import com.github.dineug.erdeditorintellijplugin.hub.testing.awaitUntil
import com.github.dineug.erdeditorintellijplugin.hub.transport.platformListenerFactory
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ThreadLocalRandom
import java.util.concurrent.atomic.AtomicInteger

/**
 * Joins over a real unix socket, or a named pipe on Windows, read by a TestPeer as the MCP server
 * reads them: a join's answer before the actions its window held back, a join after shutdown, and
 * a peer whose paths leave the lock's folders, which the hub closes and ends on its own.
 */
class JoinOverSocketTest {
    @get:Rule
    val timeout: Timeout = Timeout.seconds(30)

    @get:Rule
    val testThreads = TestThreads()

    private val log = RecordingLog()
    private val peers = CopyOnWriteArrayList<TestPeer>()
    private val cleanups = CopyOnWriteArrayList<() -> Unit>()

    @After
    fun tearDown() {
        peers.forEach(TestPeer::close)
        cleanups.reversed().forEach { it() }
    }

    @Test
    fun `writes the join answer before the actions its window held back`() {
        val harness = DocumentHarness(testThreads.create(log), log, PATIENT_TIMINGS)
        val editor = harness.openReady(PATH, "{}")
        val peer = servePeer(harness)
        harness.relay(editor, add(1))

        peer.send(request(2, "join", PATH))
        awaitUntil(message = "the join waits in its window") { harness.onRegistry { entryAt(PATH).peers.size == 1 } }
        harness.relay(editor, add(2))
        harness.save(editor, """{"saved":2}""")
        harness.relay(editor, add(3))

        assertEquals(
            listOf(
                """{"id":2,"ok":true,"method":"join","result":{"initialValue":"{\"saved\":2}","snapshotVersion":2,"readonly":false}}""",
                """{"method":"actions","params":{"path":"$PATH","actions":[${add(3)}]}}""",
            ),
            peer.receiveFrames(2),
        )
    }

    @Test
    fun `answers a join after shutdown from disk, and only then tells the peer documentClosed`() {
        val harness = DocumentHarness(testThreads.create(log), log)
        harness.openReady(PATH, """{"on":"disk"}""")
        val peer = servePeer(harness)
        harness.onRegistry { shutdown() }

        peer.send(request(2, "join", PATH))

        assertEquals(
            listOf(
                """{"id":2,"ok":true,"method":"join","result":{"initialValue":"{\"on\":\"disk\"}","snapshotVersion":0,"readonly":false}}""",
                closed(PATH),
            ),
            peer.receiveFrames(2),
        )
    }

    @Test
    fun `closes and ends a peer whose folder leaves the lock, and leaves a peer of a folder kept alone`() {
        val served = Served()
        val a = served.document(served.p1, "a.erd.json")
        val b = served.document(served.p2, "b.erd.json")
        val peerA = served.peer()
        val peerB = served.peer()
        peerA.send(request(2, "join", a))
        peerB.send(request(2, "join", b))
        assertEquals(joinedEmpty(2), peerA.receiveFrames(1).single())
        assertEquals(joinedEmpty(2), peerB.receiveFrames(1).single())

        served.shrinkTo(served.p2)

        assertEquals(listOf(closed(a)), peerA.awaitEof())
        peerB.send(request(3, "leave", b))
        assertEquals(left(3), peerB.receiveFrames(1).single())
        assertFalse(peerB.isEnded)
    }

    @Test
    fun `ends a peer whose editor closed its document once that folder leaves the lock`() {
        val served = Served()
        val s = served.document(served.p1, "s.erd.json")
        val file = FakeDocumentFile(s)
        val view = FakeView()
        served.runtime.registry.post {
            addView(file, view)
            onViewReady(file, view, EMPTY_DOCUMENT)
        }
        awaitUntil(message = "the lock lists the open document") { served.lock()?.documents == listOf(s) }
        val peer = served.peer()
        peer.send(request(2, "join", s))
        assertEquals(joinedEmpty(2), peer.receiveFrames(1).single())

        served.runtime.registry.post { removeView(file, view) }
        assertEquals(closed(s), peer.receiveFrames(1).single())
        // Still served: a raw peer is no MCP session whose own fallback could hide a connection left open.
        peer.send(request(3, "leave", s))
        assertEquals(left(3), peer.receiveFrames(1).single())

        served.shrinkTo(served.p2)

        assertEquals(emptyList<String>(), peer.awaitEof())
    }

    /** serveConnection behind the platform's real listener, in front of the harness's handler, as Obsidian's servePeer. */
    private fun servePeer(harness: DocumentHarness): TestPeer {
        val platform = HubPlatform.current()
        val pipe = if (platform.isWindows) "\\\\.\\pipe\\erd-editor-ide-test-${UUID.randomUUID()}" else socketIn(tempDir())
        val served = CopyOnWriteArrayList<ServedConnection>()
        val ids = AtomicInteger()
        val options = ServeOptions(TOKEN, "intellij", "0.0.0-test", harness.handler, { it }, ids::incrementAndGet, harness.threads, log)
        val listener = platformListenerFactory(platform, harness.threads.ioExecutor, log).listen(pipe) { channel ->
            serveConnection(channel, options).also(served::add).start()
        }
        cleanups += {
            listener.close()
            served.forEach(ServedConnection::destroyNow)
        }
        return connect(pipe, TOKEN)
    }

    /**
     * A HubRuntime on a temp home whose host lists the folders p1 and p2. Its pid is made up, so on
     * Windows it binds a pipe of its own, never the name of this JVM's pid, which the conformance run binds.
     */
    private inner class Served {
        private val home: Path = tempDir()
        private val env = MachineEnvironment(
            home.toString(), Files.createDirectory(home.resolve("t")).toString(), HubPlatform.current(),
            ThreadLocalRandom.current().nextLong(2_000_000_000L, 2_100_000_000L), "0.0.0-test",
        )

        // By the real path as the hub spells it, which on Windows is not always the JDK's spelling.
        val p1: Path = realDirectory("p1")
        val p2: Path = realDirectory("p2")
        private val host = MemoryHost(ide = "intellij", roots = listOf(p1.toString(), p2.toString()))
        private val ide = FakeIdeFacade().apply { projects = listOf(ProjectTrust(host.roots, trusted = true)) }
        val runtime = HubRuntime(
            env, host, ide, hooks = RecordingHooks(), log = log, platform = env.platform, threads = testThreads.create(log),
        )

        init {
            cleanups += runtime::dispose
            runtime.start()
            awaitUntil(message = "the lock serves") { lock()?.hub == true }
        }

        fun lock(): LockRecord? = try {
            parseLock(Files.readString(Path.of(LockPaths.lockFilePath(env.homeDir, env.pid))))
        } catch (e: IOException) {
            null
        }

        /** A peer through the pipe the lock names, past hello. */
        fun peer(): TestPeer = checkNotNull(lock()).let { connect(it.pipe, it.token) }

        /** An empty document written in folder; its path, real as the folder is. */
        fun document(folder: Path, name: String): String =
            Files.writeString(folder.resolve(name), EMPTY_DOCUMENT).toString()

        private fun realDirectory(name: String): Path =
            Path.of((env.realPath(Files.createDirectory(home.resolve(name)).toString()) as RealPathResult.Ok).path)

        /** The host's folders become these, and the lock lists them. */
        fun shrinkTo(vararg folders: Path) {
            host.roots = folders.map(Path::toString)
            host.fireFoldersChange()
            awaitUntil(message = "the lock lists the folders left") { lock()?.workspaceFolders == host.roots }
        }
    }

    private fun connect(pipe: String, token: String): TestPeer = TestPeer.connect(pipe).also(peers::add).apply {
        send("""{"id":1,"method":"hello","params":{"token":"$token","protocolVersion":1,"client":"spec"}}""")
        val answer = receiveFrames(1).single()
        assertTrue(answer, answer.startsWith("""{"id":1,"ok":true,"method":"hello""""))
    }

    /** A short directory of its own, under /tmp on POSIX so a socket path in it stays short. */
    private fun tempDir(): Path {
        val dir = if (HubPlatform.current().isWindows) {
            Files.createTempDirectory("erdj")
        } else {
            Files.createTempDirectory(Path.of("/tmp"), "erdj")
        }
        cleanups += { dir.toFile().deleteRecursively() }
        return dir
    }

    private fun socketIn(dir: Path): String = dir.resolve("hub.sock").toString().also {
        assertTrue("$it fits a socket address", LockPaths.pipePathFits(it, HubPlatform.current()))
    }

    private companion object {
        const val TOKEN = "6f1c2e0a-8f7e-4d4c-9a51-3a8e2b1d0c9f"
        const val PATH = "$WS/a.erd.json"
        const val EMPTY_DOCUMENT = """{"version":"3.0.0"}"""

        fun request(id: Int, method: String, path: String) =
            """{"id":$id,"method":"$method","params":{"path":${HubJson.quote(path)}}}"""

        fun closed(path: String) = """{"method":"documentClosed","params":{"path":${HubJson.quote(path)}}}"""

        /** The answer to a join of EMPTY_DOCUMENT that nothing changed, from the disk or from an editor. */
        fun joinedEmpty(id: Int) =
            """{"id":$id,"ok":true,"method":"join","result":{"initialValue":${HubJson.quote(EMPTY_DOCUMENT)},""" +
                """"snapshotVersion":0,"readonly":false}}"""

        fun left(id: Int) = """{"id":$id,"ok":true,"method":"leave","result":{}}"""
    }
}
