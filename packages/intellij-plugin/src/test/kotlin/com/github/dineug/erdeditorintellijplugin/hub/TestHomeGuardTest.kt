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
 * No test may bind a socket or write a lock under the real home, so no test reads it: only
 * MachineEnvironmentTest names the home's property, and every forMachine call in a test passes
 * its env and props explicitly, as TypeScript's imports.test.ts files guard their imports.
 */
class TestHomeGuardTest {
    private val testSources: Path = Path.of(System.getProperty("erd.hub.mainSources") ?: "src/main/kotlin")
        .toAbsolutePath().parent.resolveSibling("test").resolve("kotlin")

    @Test
    fun `leaves the real home to MachineEnvironmentTest`() {
        val files = Files.walk(testSources).use { walk -> walk.filter { it.name.endsWith(".kt") }.toList() }
        assertTrue("found the test sources under $testSources", files.any { it.name == "MachineEnvironmentTest.kt" })

        val offending = files.filterNot { it.name in EXEMPT }.flatMap { file ->
            val relative = testSources.relativize(file).invariantSeparatorsPathString
            HomeCheck.violations(file.readText()).map { "$relative:$it" }
        }
        assertEquals(emptyList<String>(), offending)
    }

    @Test
    fun `finds the home property, the home variables and a forMachine call that reads the machine`() {
        val source = listOf(
            "val home = System.getProperty(\"user.home\")",
            "val posix = System.getenv( \"HOME\" )",
            "val windows = System.getenv(\"USERPROFILE\")",
            "val everything = System.getenv()",
            "val machine = MachineEnvironment.forMachine(\"1.0.0\")",
            "val half = MachineEnvironment.forMachine(\"1.0.0\", env = emptyMap())",
            "val fine = MachineEnvironment.forMachine(\"1.0.0\", env = mapOf(\"A\" to f(\"x\")), props = Properties())",
            "val other = System.getenv(\"HOMEPAGE\")",
        ).joinToString("\n")

        assertEquals(
            listOf(
                "1: user.home", "2: getenv( \"HOME\" )", "3: getenv(\"USERPROFILE\")", "4: getenv()",
                "5: forMachine without env and props", "6: forMachine without env and props",
            ),
            HomeCheck.violations(source),
        )
    }

    private companion object {
        val EXEMPT = setOf("MachineEnvironmentTest.kt", "TestHomeGuardTest.kt")
    }
}

/** The ways a test source could reach the real home, each with its line number. */
private object HomeCheck {
    private val homeReads = Regex("""user\.home|getenv\(\s*"(?:HOME|USERPROFILE)"\s*\)|getenv\(\s*\)""")
    private val ENV_ARGUMENT = Regex("""\benv\s*=""")
    private val PROPS_ARGUMENT = Regex("""\bprops\s*=""")

    fun violations(source: String): List<String> {
        val found = ArrayList<Pair<Int, String>>()
        for (match in homeReads.findAll(source)) found += lineOf(source, match.range.first) to match.value
        var from = source.indexOf("forMachine(")
        while (from != -1) {
            val arguments = argumentsAt(source, from + "forMachine(".length)
            if (!(ENV_ARGUMENT.containsMatchIn(arguments) && PROPS_ARGUMENT.containsMatchIn(arguments))) {
                found += lineOf(source, from) to "forMachine without env and props"
            }
            from = source.indexOf("forMachine(", from + 1)
        }
        return found.sortedBy { it.first }.map { (line, text) -> "$line: $text" }
    }

    /** The text up to the parenthesis that closes the call opened just before start. */
    private fun argumentsAt(source: String, start: Int): String {
        var depth = 1
        var index = start
        while (index < source.length && depth > 0) {
            when (source[index]) {
                '(' -> depth++
                ')' -> depth--
            }
            index++
        }
        return source.substring(start, index)
    }

    private fun lineOf(source: String, index: Int): Int = source.substring(0, index).count { it == '\n' } + 1
}
