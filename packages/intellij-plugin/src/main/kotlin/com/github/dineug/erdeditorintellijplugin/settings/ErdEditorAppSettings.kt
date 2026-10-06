package com.github.dineug.erdeditorintellijplugin.settings

import com.intellij.DynamicBundle
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
 * The theme and display language every ERD editor shows, set on the settings page or from a page's
 * toolbar. Each auto is kept as stored; a page is sent what it follows, the IDE's own, beside it.
 */
@State(
    name = "com.github.dineug.erdeditorintellijplugin.settings.ErdEditorAppSettings",
    storages = [Storage("erd-editor.xml")]
)
@Service
class ErdEditorAppSettings @NonInjectable internal constructor(
    private val isIdeDark: () -> Boolean,
    private val ideLanguage: () -> String,
    private val publish: (ErdEditorAppSettings) -> Unit
) : PersistentStateComponent<ErdEditorAppSettings.State> {

    // The IDE's own: JBColor's flag, set before LafManagerListener subscribers hear of a new look and
    // feel, the language the IDE shows its own UI in, and the message bus every open editor listens
    // on. Tests hand in their own three.
    constructor() : this({ !JBColor.isBright() }, { DynamicBundle.getLocale().toLanguageTag() }, { settings ->
        ApplicationManager.getApplication().messageBus.syncPublisher(SettingsChangedListener.TOPIC)
            .onSettingsChange(settings)
    })

    // The settings page writes them on the EDT, a page's toolbar from its editor's bridge thread.
    private val stored = AtomicReference(ErdEditorTheme.DEFAULT)
    private val storedLocale = AtomicReference(ErdEditorLocale.DEFAULT)

    /** The theme as the settings keep it, auto included. */
    val theme: ErdEditorTheme get() = stored.get()

    /** The light or dark auto shows now, the IDE's own. */
    val systemAppearance: String get() = ErdEditorTheme.systemAppearance(isIdeDark())

    /** The display language as the settings keep it, auto included. */
    val locale: String get() = storedLocale.get()

    /** The language auto follows, the one the IDE shows its own UI in, as a BCP 47 tag. */
    val systemLocale: String get() = ideLanguage()

    override fun getState(): State =
        theme.let { State(it.appearance, it.grayColor, it.accentColor, locale) }

    /** A value that is missing or unknown, as a hand edit or another release may leave, is the default. */
    override fun loadState(state: State) {
        stored.set(
            ErdEditorTheme.read(state.appearance, state.grayColor, state.accentColor, ErdEditorTheme.DEFAULT)
        )
        storedLocale.set(ErdEditorLocale.read(state.locale, ErdEditorLocale.DEFAULT))
    }

    /**
     * Stores a display language from the settings page or a page's language picker, its System
     * arriving as auto, and has every open editor show it when that changed the setting. A value
     * the setting cannot hold keeps the stored one.
     */
    fun updateLocale(value: String) {
        if (value !in ErdEditorLocale.SETTINGS) return
        if (storedLocale.getAndSet(value) != value) publish(this)
    }

    /** Keeps what a page's theme builder picked, auto included; anything missing or unknown keeps the stored value. */
    fun setThemeFromBuilder(appearance: String?, grayColor: String?, accentColor: String?) {
        updateTheme { ErdEditorTheme.read(appearance, grayColor, accentColor, it) }
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
        var accentColor: String = ErdEditorTheme.DEFAULT.accentColor,
        var locale: String = ErdEditorLocale.DEFAULT
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
