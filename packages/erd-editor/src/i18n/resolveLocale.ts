import { LocaleCode, LocaleCodeList } from '@/i18n/locales';

const ENGLISH: LocaleCode = 'en';

/** The one display language of each language subtag the editor has a single dictionary for. */
const LanguageToLocale = new Map<string, LocaleCode>(
  LocaleCodeList.filter(
    code => !code.startsWith('pt-') && !code.startsWith('zh-')
  ).map(code => [code.split('-')[0], code])
);

const TRADITIONAL_CHINESE_REGIONS = new Set(['TW', 'HK', 'MO']);

/**
 * Chinese goes by its script, then by the regions that write the traditional
 * one; Portuguese is Brazilian unless a region other than Brazil is named, so a
 * bare pt reads as the larger audience.
 */
function localeOfTag(tag: string): LocaleCode | null {
  const { language, script, region } = new Intl.Locale(
    tag.trim().replaceAll('_', '-')
  );

  if (language === 'zh') {
    if (script) return script === 'Hant' ? 'zh-TW' : 'zh-CN';
    return region && TRADITIONAL_CHINESE_REGIONS.has(region)
      ? 'zh-TW'
      : 'zh-CN';
  }

  if (language === 'pt') {
    return region && region !== 'BR' ? 'pt-PT' : 'pt-BR';
  }

  return LanguageToLocale.get(language) ?? null;
}

/**
 * The display language a list of BCP 47 tags asks for, read in order, case and
 * underscores ignored: the first tag the editor has a language for wins, and
 * English stands in for none. It reads no navigator; the caller hands the tags.
 *
 * @example
 * resolveLocale(['nb', 'de']); // 'de-DE'
 */
export function resolveLocale(
  tags: string | ReadonlyArray<string> | null | undefined
): LocaleCode {
  const list = typeof tags === 'string' ? [tags] : (tags ?? []);

  for (const tag of list) {
    try {
      const code = localeOfTag(tag);
      if (code) return code;
    } catch {
      // Intl.Locale refuses an empty tag, a wildcard and a private use tag,
      // none of which names a language, so the next tag is read instead.
    }
  }

  return ENGLISH;
}
