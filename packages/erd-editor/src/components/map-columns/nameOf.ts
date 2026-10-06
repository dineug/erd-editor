import type { I18n } from '@/i18n/translate';

/** A table's or column's name as Map Columns and the draw-target buttons write it, unnamed where it has none. */
export const nameOf = (
  entity: { name: string } | undefined,
  { t }: Pick<I18n, 't'>
) => (entity?.name.trim() ? entity.name : t('common.unnamed'));
