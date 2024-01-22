package com.github.dineug.erdeditorintellijplugin.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.messages.Topic
import com.intellij.util.xmlb.XmlSerializerUtil

@State(
    name = "com.github.dineug.erdeditorintellijplugin.settings.ErdEditorAppSettings",
    storages = [Storage("erd-editor.xml")]
)
@Service
class ErdEditorAppSettings : PersistentStateComponent<ErdEditorAppSettings.State> {
    private val myState = State()

    override fun getState(): State {
        return myState
    }

    override fun loadState(state: State) {
        XmlSerializerUtil.copyBean(state, myState)
    }

    fun setTheme(state: State) {
        XmlSerializerUtil.copyBean(state, myState)

        ApplicationManager.getApplication().messageBus.syncPublisher(SettingsChangedListener.TOPIC)
            .onSettingsChange(this)
    }

    class State (
        var appearance: String = "dark",
        var grayColor: String = "slate",
        var accentColor: String = "indigo"
    )

    companion object {
        val instance: ErdEditorAppSettings
            get() = ApplicationManager.getApplication().getService(ErdEditorAppSettings::class.java)
    }

    interface SettingsChangedListener {
        fun onSettingsChange(settings: ErdEditorAppSettings)

        companion object {
            val TOPIC = Topic.create(
                "ErdEditorAppSettingsChanged",
                SettingsChangedListener::class.java
            )
        }
    }
}