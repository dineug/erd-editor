import { getLiveDomainName } from '@/engine/modules/dictionary/membership';
import {
  drawsDomainInTypeCell,
  isLogicalNameView,
} from '@/engine/modules/editor/utils/nameView';
import type { RootState } from '@/engine/state';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import type { Column } from '@/internal-types';

type ViewSettings = Pick<RootState['settings'], 'nameViewMode'>;

type Names = { name: string; logicalName: string };

/** What a cell drawn in the DOM shows, the placeholder dimmed while the value is blank. */
export type CellText = { value: string; placeholder: string };

/**
 * What a logical name cell drawn in the DOM shows, as the canvas draws it: the
 * logical name, or while it is blank the name in the logical view, that name's
 * own placeholder while it is blank too, and in the view of both the logical name's.
 */
export function logicalNameCellText(
  settings: ViewSettings,
  { name, logicalName }: Names,
  nameKey: PlainMessageKey,
  { t }: Pick<I18n, 't'>
): CellText {
  if (!isLogicalNameView(settings)) {
    return {
      value: logicalName,
      placeholder: t('common.placeholder.logicalName'),
    };
  }

  return { value: logicalName, placeholder: name.trim() ? name : t(nameKey) };
}

/** What the name cell of a row drawn in the DOM shows: the logical view puts the logical name there. */
export function nameCellText(
  settings: ViewSettings,
  column: Names,
  i18n: Pick<I18n, 't'>
): CellText {
  return isLogicalNameView(settings)
    ? logicalNameCellText(settings, column, 'common.placeholder.column', i18n)
    : { value: column.name, placeholder: i18n.t('common.placeholder.column') };
}

/**
 * What the type cell of a row drawn in the DOM shows: the name of the listed
 * domain it stands for in the logical view, else the type.
 */
export const typeCellText = (
  state: RootState,
  column: Pick<Column, 'dataType' | 'domainId'>
): string =>
  drawsDomainInTypeCell(state, column)
    ? getLiveDomainName(state, column.domainId)
    : column.dataType;

/**
 * What the domain cell of a row drawn in the DOM holds: the listed domain's
 * name, or nothing, over which the row dims the domain placeholder.
 */
export const domainCellText = (
  state: RootState,
  column: Pick<Column, 'domainId'>
): string => getLiveDomainName(state, column.domainId);
