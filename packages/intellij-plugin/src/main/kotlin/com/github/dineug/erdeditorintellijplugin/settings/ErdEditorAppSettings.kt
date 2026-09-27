package com.github.dineug.erdeditorintellijplugin.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.serviceContainer.NonInjectable
import com.intellij.ui.JBColor
import com.intellij.util.messages.Topic
import java.util.concurrent.atomic.AtomicReference

/**
 * The theme every ERD editor shows, set on the settings page or by a page's theme builder. Auto is
 * kept as stored and resolved here, by the IDE's light or dark theme, before any page sees it.
 */
@State(
    name = "com.github.dineug.erdeditorintellijplugin.settings.ErdEditorAppSettings",
    storages = [Storage("erd-editor.xml")]
)
@Service
class ErdEditorAppSettings @NonInjectable internal constructor(
    private val isIdeDark: () -> Boolean,
    private val publish: (ErdEditorAppSettings) -> Unit
) : PersistentStateComponent<ErdEditorAppSettings.State> {

    // The IDE's own: JBColor's flag, set before LafManagerListener subscribers hear of a new look and
    // feel, and the message bus every open editor listens on. Tests hand in their own two.
    constructor() : this({ !JBColor.isBright() }, { settings ->
        ApplicationManager.getApplication().messageBus.syncPublisher(SettingsChangedListener.TOPIC)
            .onSettingsChange(settings)
    })

    // The settings page writes it on the EDT, a theme builder from its editor's bridge thread.
    private val stored = AtomicReference(ErdEditorTheme.DEFAULT)

    /** The theme as the settings keep it, auto included. */
    val theme: ErdEditorTheme get() = stored.get()

    /** The theme the pages show now, auto resolved by the IDE's light or dark theme. */
    val shownTheme: ErdEditorTheme get() = theme.resolve(isIdeDark())

    override fun getState(): State = theme.let { State(it.appearance, it.grayColor, it.accentColor) }

    /** A value that is missing or unknown, as a hand edit or another release may leave, is the default. */
    override fun loadState(state: State) {
        stored.set(
            ErdEditorTheme.read(state.appearance, state.grayColor, state.accentColor, ErdEditorTheme.DEFAULT)
        )
    }

    /** Keeps what a page's theme builder picked, by [ErdEditorTheme.fromBuilder]. */
    fun setThemeFromBuilder(appearance: String?, grayColor: String?, accentColor: String?) {
        val ideDark = isIdeDark()
        updateTheme { it.fromBuilder(appearance, grayColor, accentColor, ideDark) }
    }

    /**
     * Stores what [transform] makes of the stored theme, from the stored theme again when another
     * write came first, and has every open editor show it when that changed the setting.
     */
    fun updateTheme(transform: (ErdEditorTheme) -> ErdEditorTheme) {
        while (true) {
            val current = stored.get()
            val next = transform(current)
            if (next == current) return
            if (stored.compareAndSet(current, next)) return publish(this)
        }
    }

    class State(
        var appearance: String = ErdEditorTheme.DEFAULT.appearance,
        var grayColor: String = ErdEditorTheme.DEFAULT.grayColor,
        var accentColor: String = ErdEditorTheme.DEFAULT.accentColor
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
