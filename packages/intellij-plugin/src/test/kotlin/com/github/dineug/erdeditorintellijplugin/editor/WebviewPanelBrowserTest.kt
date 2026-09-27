package com.github.dineug.erdeditorintellijplugin.editor

import org.cef.browser.CefBrowser
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Proxy

class WebviewPanelBrowserTest {
    /** A CefBrowser that answers only getIdentifier, as every query's sender is compared by. */
    private fun browser(id: Int): CefBrowser =
        Proxy.newProxyInstance(CefBrowser::class.java.classLoader, arrayOf(CefBrowser::class.java)) { self, method, args ->
            when (method.name) {
                "getIdentifier" -> id
                "equals" -> self === args?.get(0)
                "hashCode" -> System.identityHashCode(self)
                "toString" -> "CefBrowser($id)"
                else -> throw UnsupportedOperationException(method.name)
            }
        } as CefBrowser

    @Test
    fun `answers its own browser, the same object or another handle on it`() {
        val own = browser(7)

        assertTrue(isSameBrowser(own, own))
        assertTrue(isSameBrowser(browser(7), own))
    }

    @Test
    fun `leaves another tab's browser, or none, to the other routers`() {
        val own = browser(7)

        assertFalse(isSameBrowser(browser(8), own))
        assertFalse(isSameBrowser(null, own))
    }
}
