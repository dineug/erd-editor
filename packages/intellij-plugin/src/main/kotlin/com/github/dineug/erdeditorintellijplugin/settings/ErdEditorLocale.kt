package com.github.dineug.erdeditorintellijplugin.settings

/**
 * The display languages the settings page, the stored state and a page's language picker share. The
 * list is packages/webview-bridge's LocaleLabel, which ErdEditorLocaleTest reads to catch a drift;
 * auto is the host's spelling of the editor's System, as the VS Code and Obsidian settings spell it.
 */
object ErdEditorLocale {
    const val AUTO = "auto"

    /** Auto follows the IDE's language, as the other hosts' default follows theirs. */
    const val DEFAULT = AUTO

    /** Every language the editor offers, code to its own name, in the order its picker lists them. */
    val NAMES: Map<String, String> = linkedMapOf(
        "en" to "English",
        "id-ID" to "Bahasa Indonesia",
        "de-DE" to "Deutsch",
        "es-ES" to "Español",
        "eu-ES" to "Euskara",
        "fr-FR" to "Français",
        "it-IT" to "Italiano",
        "nl-NL" to "Nederlands",
        "pl-PL" to "Polski",
        "pt-PT" to "Português",
        "pt-BR" to "Português Brasileiro",
        "ro-RO" to "Română",
        "sk-SK" to "Slovenčina",
        "sl-SI" to "Slovenščina",
        "sv-SE" to "Svenska",
        "tr-TR" to "Türkçe",
        "ru-RU" to "Русский",
        "uk-UA" to "Українська",
        "he-IL" to "עברית",
        "ar-SA" to "العربية",
        "fa-IR" to "فارسی",
        "ja-JP" to "日本語",
        "zh-CN" to "简体中文",
        "zh-TW" to "繁體中文",
        "ko-KR" to "한국어"
    )

    /** What the setting can hold, in the settings page's order: auto, then every code. */
    val SETTINGS: List<String> = listOf(AUTO) + NAMES.keys

    /** [value] when the setting can hold it, spelled exactly so, else [fallback]. */
    fun read(value: String?, fallback: String): String =
        if (value != null && value in SETTINGS) value else fallback

    /** The settings page's name for a value: Auto, or the language's own name. */
    fun optionName(value: String): String = if (value == AUTO) "Auto" else NAMES[value] ?: value
}
