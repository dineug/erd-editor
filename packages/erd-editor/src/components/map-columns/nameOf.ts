import {
  nameLabelText,
  toNameLabel,
} from '@/engine/modules/editor/utils/nameView';
import type { RootState } from '@/engine/state';
import type { I18n } from '@/i18n/translate';

type ViewSettings = Pick<RootState['settings'], 'nameViewMode'>;

/**
 * A table's or column's name as Map Columns, the draw-target buttons and the
 * check sheet write it: the one the name view shows, the name after the
 * logical name in the view of both, and unnamed where it shows none.
 */
export function nameOf(
  entity: { name: string; logicalName: string } | undefined,
  { t }: Pick<I18n, 't'>,
  settings: ViewSettings
): string {
  const text = entity ? nameLabelText(toNameLabel(settings, entity)) : '';
  return text.trim() ? text : t('common.unnamed');
}
