package com.github.dineug.erdeditorintellijplugin.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.messages.Topic
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The Coding agents setting. It is its own component, so the theme's state never carries the flag
 * and each is read and written apart; both components share erd-editor.xml under their own names.
 */
@Service(Service.Level.APP)
@State(
    name = "com.github.dineug.erdeditorintellijplugin.settings.AgentHubSettings",
    storages = [Storage("erd-editor.xml")]
)
class AgentHubSettings : PersistentStateComponent<AgentHubSettings.State> {
    // The settings page writes it on the EDT; the hub reads it from its own threads.
    private val enabled = AtomicBoolean(true)

    var codingAgents: Boolean
        get() = enabled.get()
        set(value) = update(value) {
            ApplicationManager.getApplication().messageBus.syncPublisher(Listener.TOPIC)
                .codingAgentsChanged(it)
        }

    override fun getState(): State = State().also { it.codingAgents = enabled.get() }

    override fun loadState(state: State) {
        enabled.set(state.codingAgents)
    }

    /** Stores [value] and calls [publish] with it only when that changed the setting. */
    internal fun update(value: Boolean, publish: (Boolean) -> Unit) {
        if (enabled.compareAndSet(!value, value)) publish(value)
    }

    class State {
        var codingAgents: Boolean = true
    }

    interface Listener {
        fun codingAgentsChanged(enabled: Boolean)

        companion object {
            val TOPIC: Topic<Listener> = Topic.create(
                "ErdEditorAgentHubSettingsChanged",
                Listener::class.java
            )
        }
    }

    companion object {
        val instance: AgentHubSettings
            get() = ApplicationManager.getApplication().getService(AgentHubSettings::class.java)
    }
}
