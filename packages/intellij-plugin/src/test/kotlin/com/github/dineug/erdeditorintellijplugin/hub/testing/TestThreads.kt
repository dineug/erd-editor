package com.github.dineug.erdeditorintellijplugin.hub.testing

import com.github.dineug.erdeditorintellijplugin.hub.HubLog
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runners.model.MultipleFailureException
import org.junit.runners.model.Statement
import java.util.concurrent.CopyOnWriteArrayList

/**
 * A rule (@get:Rule val threads = TestThreads()) whose create(log) builds the HubThreads a test runs
 * the hub on, named after the suite and test; after the test it shuts them all down and fails the
 * test when a thread of that name outlives the shutdown, so no suite leaks a thread into the next.
 */
class TestThreads(private val shutdownBoundMs: Long = 2_000) : TestRule {
    private val created = CopyOnWriteArrayList<HubThreads>()

    /** "erd-editor-hub-<suite>-<test>"; every thread this rule builds is named "$prefix-…". */
    lateinit var prefix: String
        private set

    fun create(log: HubLog): HubThreads = HubThreads(log, "$prefix-${created.size + 1}").also { created += it }

    /** The live threads this test's HubThreads started. */
    fun liveThreads(): List<Thread> =
        Thread.getAllStackTraces().keys.filter { it.isAlive && it.name.startsWith("$prefix-") }

    override fun apply(base: Statement, description: Description): Statement = object : Statement() {
        override fun evaluate() {
            prefix = "erd-editor-hub-${description.testClass?.simpleName}-${description.methodName}"
            val errors = ArrayList<Throwable>()
            try {
                base.evaluate()
            } catch (e: Throwable) {
                errors += e
            } finally {
                created.forEach { it.shutdown(shutdownBoundMs) }
                try {
                    awaitUntil(shutdownBoundMs, "no thread named $prefix-… left") { liveThreads().isEmpty() }
                } catch (e: AssertionError) {
                    errors += AssertionError("${e.message}: ${liveThreads().map { it.name }}")
                }
                created.clear()
            }
            MultipleFailureException.assertEmpty(errors)
        }
    }
}
