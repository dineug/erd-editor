package com.github.dineug.erdeditorintellijplugin.hub

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.invariantSeparatorsPathString
import kotlin.io.path.name
import kotlin.io.path.readText

/**
 * The hub's core runs in plain JUnit, in a standalone conformance run and on the hub's own threads,
 * so it uses no IntelliJ Platform API, imported or spelled out in full, not even for liveness, which
 * binds libc itself through JNA; the IDE layer adapts the platform.
 */
class HubImportsTest {
    private val hubSources: Path = Path.of(
        System.getProperty("erd.hub.mainSources") ?: "src/main/kotlin",
        "com", "github", "dineug", "erdeditorintellijplugin", "hub",
    )

    @Test
    fun `uses only the JDK, Kotlin, coroutines, Jackson, JNA and the hub itself`() {
        val files = Files.walk(hubSources).use { walk -> walk.filter { it.name.endsWith(".kt") }.toList() }
        assertTrue("found the hub sources under $hubSources", files.size >= 15)

        val offending = files.flatMap { file ->
            val relative = hubSources.relativize(file).invariantSeparatorsPathString
            HubApiCheck.violations(file.name, file.readText()).map { "$relative:$it" }
        }
        assertEquals(emptyList<String>(), offending)
    }

    @Test
    fun `finds a platform name in imports, code and strings, never in comments`() {
        val tripleQuote = "\"\"\""
        val source = """
            package com.github.dineug.erdeditorintellijplugin.hub
            import java.util.Objects
            import com.intellij.openapi.diagnostic.Logger
            import org.jetbrains.annotations.NotNull
            import com.github.dineug.erdeditorintellijplugin.hub.server.HubHost
            import com.intellij.execution.process.UnixProcessManager
            /** Unlike com.intellij.openapi.Disposable, /* nested org.cef.CefApp */ still com.intellij.X. */
            fun `it's fine`() = 1 // org.cef.Z
            val log = com.intellij.openapi.diagnostic.Logger.getInstance("x") // org.cef.CefApp
            val url = "http://example.com/a" + org.cef.CefApp.getInstance()
            val raw = ${tripleQuote}a // "b" $tripleQuote + com.github.dineug.erdeditorintellijplugin.editor.ErdEditor()
            val quote = '"'; val tick = '\'' // com.intellij.Y
            val text = "${"$"}{ call("}") } // " + com.jetbrains.cef.JCefAppConfig.getInstance()
            val same = com.github.dineug.erdeditorintellijplugin.hub.HubJson
            val hubby = com.github.dineug.erdeditorintellijplugin.hubby.Other
            val alive = com.intellij.execution.process.UnixProcessManager.sendSignal(1, 0)
            val type = Class.forName("com.intellij.openapi.project.Project")
        """.trimIndent()

        val everywhere = listOf(
            "3: import com.intellij.openapi.diagnostic.Logger",
            "4: import org.jetbrains.annotations.NotNull",
            "9: com.intellij.openapi.diagnostic.Logger.getInstance",
            "10: org.cef.CefApp.getInstance",
            "11: com.github.dineug.erdeditorintellijplugin.editor.ErdEditor",
            "13: com.jetbrains.cef.JCefAppConfig.getInstance",
            "15: com.github.dineug.erdeditorintellijplugin.hubby.Other",
            "17: com.intellij.openapi.project.Project",
        )
        val primitive = listOf(
            "6: import com.intellij.execution.process.UnixProcessManager",
            "16: com.intellij.execution.process.UnixProcessManager.sendSignal",
        )
        // No file may reach the platform: liveness binds libc through JNA itself (internal API from 263).
        for (file in listOf("MachineEnvironment.kt", "Authz.kt")) {
            assertEquals(
                (everywhere + primitive).sortedBy { it.substringBefore(':').toInt() },
                HubApiCheck.violations(file, source),
            )
        }
    }
}

/** §2.1 rule 1 over one source: imports outside the allowed prefixes, and platform names anywhere in code. */
private object HubApiCheck {
    private val allowedImports = listOf(
        "java.", "kotlin.", "kotlinx.coroutines.", "com.fasterxml.jackson.", "com.sun.jna.",
        "com.github.dineug.erdeditorintellijplugin.hub.",
    )
    private val platformName = Regex(
        """(?<![\w.])(?:(?:com\.intellij|com\.jetbrains|org\.jetbrains|org\.cef)\.|""" +
            """com\.github\.dineug\.erdeditorintellijplugin\.(?!hub\b))[\w.]*""",
    )

    fun violations(fileName: String, source: String): List<String> =
        withoutComments(source).lines().flatMapIndexed { index, line ->
            val text = line.trim()
            val names = if (text.startsWith("import ")) {
                val name = text.removePrefix("import ").substringBefore(" as ").trim()
                val allowed = allowedImports.any(name::startsWith)
                if (allowed) emptyList() else listOf("import $name")
            } else {
                platformName.findAll(line).map { it.value.trimEnd('.') }.toList()
            }
            names.map { "${index + 1}: $it" }
        }


    /** The source with every comment blanked and its newlines kept; strings and templates stay code. */
    private fun withoutComments(source: String): String {
        val out = StringBuilder(source)
        // Per open string template: whether its string is raw, and the brace depth its closing brace ends.
        val templates = ArrayDeque<Pair<Boolean, Int>>()
        var inString = false
        var raw = false
        var braces = 0
        var index = 0
        while (index < source.length) {
            val char = source[index]
            if (!inString) {
                when {
                    source.startsWith("//", index) -> index = blank(out, index, lineEnd(source, index))
                    source.startsWith("/*", index) -> index = blank(out, index, blockCommentEnd(source, index))
                    source.startsWith("\"\"\"", index) -> {
                        inString = true
                        raw = true
                        index += 3
                    }
                    char == '"' -> {
                        inString = true
                        raw = false
                        index++
                    }
                    char == '\'' -> index = charLiteralEnd(source, index)
                    char == '`' -> index = source.indexOf('`', index + 1).let { if (it < 0) source.length else it + 1 }
                    char == '}' && templates.lastOrNull()?.second == braces -> {
                        inString = true
                        raw = templates.removeLast().first
                        index++
                    }
                    else -> {
                        if (char == '{') braces++
                        if (char == '}') braces--
                        index++
                    }
                }
            } else {
                when {
                    source.startsWith("\${", index) -> {
                        templates.addLast(raw to braces)
                        inString = false
                        index += 2
                    }
                    raw && source.startsWith("\"\"\"", index) -> {
                        index += 3
                        while (index < source.length && source[index] == '"') index++
                        inString = false
                    }
                    !raw && char == '\\' -> index += 2
                    !raw && char == '"' -> {
                        inString = false
                        index++
                    }
                    else -> index++
                }
            }
        }
        return out.toString()
    }

    private fun blank(out: StringBuilder, from: Int, to: Int): Int {
        for (at in from until to) if (out[at] != '\n') out[at] = ' '
        return to
    }

    private fun lineEnd(source: String, from: Int): Int =
        source.indexOf('\n', from).let { if (it < 0) source.length else it }

    private fun blockCommentEnd(source: String, start: Int): Int {
        var depth = 0
        var index = start
        while (index < source.length) {
            when {
                source.startsWith("/*", index) -> {
                    depth++
                    index += 2
                }
                source.startsWith("*/", index) -> {
                    index += 2
                    if (--depth == 0) return index
                }
                else -> index++
            }
        }
        return source.length
    }

    private fun charLiteralEnd(source: String, start: Int): Int {
        var index = start + if (source.getOrNull(start + 1) == '\\') 3 else 2
        while (index < source.length && source[index] != '\'') index++
        return index + 1
    }
}
