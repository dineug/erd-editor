const COUNT_FORMATS = new Map<string, Intl.NumberFormat>();

/**
 * A count shown beside a name, a Dictionary sheet's or an Explorer folder's, its
 * thousands grouped as the language groups them, in the digits 0 to 9 every
 * other number in the editor is written in.
 *
 * @example
 * formatCount('de-DE', 13176); // '13.176'
 */
export function formatCount(locale: string, count: number): string {
  let format = COUNT_FORMATS.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { numberingSystem: 'latn' });
    COUNT_FORMATS.set(locale, format);
  }
  return format.format(count);
}
