import type { I18n, PlainMessageKey } from '@/i18n/translate';

/** A menu row named by a literal, with the key of its translation where it has one. */
export type LabeledMenu = {
  readonly name: string;
  readonly labelKey?: PlainMessageKey;
};

/**
 * What a menu row shows: its key in the reader's language, or its name where
 * it has no key, since a vendor, a format or a case name stays as written.
 */
export const menuLabel = (i18n: Pick<I18n, 't'>, menu: LabeledMenu): string =>
  menu.labelKey ? i18n.t(menu.labelKey) : menu.name;
