package com.github.dineug.erdeditorintellijplugin.editor

import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefCallback
import org.cef.callback.CefSchemeHandlerFactory
import org.cef.handler.CefResourceHandler
import org.cef.misc.IntRef
import org.cef.misc.StringRef
import org.cef.network.CefRequest
import org.cef.network.CefResponse
import java.io.IOException
import java.io.InputStream
import java.net.URI

class SchemeHandlerFactory(val getStream: (uri: URI) -> InputStream?) : CefSchemeHandlerFactory {
    override fun create(browser: CefBrowser, frame: CefFrame, schemeName: String, request: CefRequest): CefResourceHandler {
        val uri = URI(request.url)
        val stream = getStream(uri)

        return object : CefResourceHandler {
            override fun processRequest(req: CefRequest, callback: CefCallback): Boolean {
                callback.Continue()
                return true
            }

            override fun getResponseHeaders(response: CefResponse, responseLength: IntRef, redirectUrl: StringRef?) {

                when {
                    uri.path.endsWith(".html") -> response.mimeType = "text/html"
                    uri.path.endsWith(".js") -> response.mimeType = "application/javascript"
                    uri.path.endsWith(".css") -> response.mimeType = "text/css"
                }

                when{
                    stream === null -> response.status = 404
                    else -> response.status = 200
                }
            }

            override fun readResponse(dataOut: ByteArray, bytesToRead: Int, bytesRead: IntRef, callback: CefCallback): Boolean {
                if (stream === null) {
                    bytesRead.set(0)
                    return false
                }
                try {
                    val availableSize = stream.available()

                    if (availableSize > 0) {
                        bytesRead.set(stream.read(dataOut, 0, bytesToRead.coerceAtMost(availableSize)))
                        return true
                    }

                    bytesRead.set(0)

                    try {
                        stream.close()
                    } catch (_: IOException) {
                        // noop
                    }

                    return false
                } catch (ex: IOException) {
                    return false
                }
            }

            override fun cancel() {
            }
        }
    }
}
