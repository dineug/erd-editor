import type { ErdEditorElement } from '@dineug/erd-editor';

/** What the editor's setLocale takes: system, or one of its display languages. */
export type LocalePreference = Parameters<ErdEditorElement['setLocale']>[0];

/** The localStorage key of the display language, which every tab shares. */
export const LOCALE_STORAGE_KEY = '@locale';

/** Until a language is picked, the editor follows the browser's. */
export const DEFAULT_LOCALE: LocalePreference = 'system';

function readLocale(value: unknown): LocalePreference | null {
  return typeof value === 'string' && value !== ''
    ? (value as LocalePreference)
    : null;
}

/**
 * Reads whatever storage holds. Any non-empty string is kept as it is, since
 * the editor ignores a code it does not know, one a newer build stored say.
 */
export function parseLocalePreference(value: unknown): LocalePreference {
  return readLocale(value) ?? DEFAULT_LOCALE;
}

/** Folds the detail of the editor's changeLocale event into the preference. */
export function applyPickedLocale(
  current: LocalePreference,
  detail: unknown
): LocalePreference {
  const locale =
    typeof detail === 'object' && detail !== null
      ? Reflect.get(detail, 'locale')
      : undefined;

  return readLocale(locale) ?? current;
}
