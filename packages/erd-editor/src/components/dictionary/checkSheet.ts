import { query } from '@dineug/erd-editor-schema';
import type { GridColumn } from '@dineug/grid';

import { toSearchText } from '@/components/dictionary/sheets';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import { selectDictionaryRow } from '@/engine/modules/dictionary/atom.actions';
import {
  type DictionaryCheck,
  type DictionaryCheckCode,
  listDictionaryChecks,
} from '@/engine/modules/dictionary/checks';
import type { RootState } from '@/engine/state';
import { sourceI18n } from '@/i18n/source';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import type { ValuesType } from '@/internal-types';

/** The check sheet's columns: what kind of check, what it is about, and what it found. */
export const CheckColumn = {
  type: 'type',
  target: 'target',
  detail: 'detail',
} as const;
type CheckColumn = ValuesType<typeof CheckColumn>;

const CHECK_COLUMNS: ReadonlyArray<{
  id: CheckColumn;
  labelKey: PlainMessageKey;
  width: number;
}> = [
  { id: CheckColumn.type, labelKey: 'dictionary.field.type', width: 180 },
  { id: CheckColumn.target, labelKey: 'dictionary.field.target', width: 240 },
  { id: CheckColumn.detail, labelKey: 'dictionary.field.detail', width: 360 },
];

const CHECK_LABEL_KEY: Readonly<Record<DictionaryCheckCode, PlainMessageKey>> =
  {
    duplicateName: 'dictionary.check.duplicateName',
    unknownDomain: 'dictionary.check.unknownDomain',
    unregisteredWord: 'dictionary.check.unregisteredWord',
    forbiddenWord: 'dictionary.check.forbiddenWord',
    synonymWord: 'dictionary.check.synonymWord',
    physicalNameMismatch: 'dictionary.check.physicalNameMismatch',
  };

type Translator = Pick<I18n, 't' | 'locale'>;

/**
 * The check sheet's three columns, labelled in the reader's language and
 * read-only in every document, since a check is read off the other sheets
 * and the tables, never written.
 */
export function checkSheetColumns(
  widths: Readonly<Record<string, number>> = {},
  i18n: Pick<I18n, 't'> = sourceI18n
): GridColumn[] {
  return CHECK_COLUMNS.map(({ id, labelKey, width }) => ({
    id,
    label: i18n.t(labelKey),
    width: widths[id] ?? width,
    readonly: true,
  }));
}

/** A table by its name, a column as its table's name and its own joined by a dot, a dictionary row by its name. */
function targetText(state: RootState, { target }: DictionaryCheck): string {
  const tables = query(state.collections).collection('tableEntities');

  switch (target.kind) {
    case 'table':
      return tables.selectById(target.id)?.name ?? '';
    case 'column': {
      const column = query(state.collections)
        .collection('tableColumnEntities')
        .selectById(target.id);
      const table = tables.selectById(target.tableId);
      return `${table?.name ?? ''}.${column?.name ?? ''}`;
    }
    case DictionaryKind.word:
    case DictionaryKind.term:
    case DictionaryKind.domain:
      return selectDictionaryRow(state, target.kind, target.id)?.name ?? '';
  }
}

/** What the check found, then after an arrow the words or the name the dictionaries offer instead. */
function detailText(
  { text, suggestions }: DictionaryCheck,
  i18n: Pick<I18n, 'locale'>
): string {
  if (!suggestions.length) return text;

  const offered = new Intl.ListFormat(i18n.locale, { type: 'unit' }).format(
    suggestions
  );
  return `${text} → ${offered}`;
}

/** What a cell of the check sheet shows, nothing for a column the sheet lacks. */
export function checkCellText(
  state: RootState,
  check: DictionaryCheck,
  columnId: string,
  i18n: Translator = sourceI18n
): string {
  switch (columnId) {
    case CheckColumn.type:
      return i18n.t(CHECK_LABEL_KEY[check.code]);
    case CheckColumn.target:
      return targetText(state, check);
    case CheckColumn.detail:
      return detailText(check, i18n);
    default:
      return '';
  }
}

/**
 * The checks the sheet lists, in the order the document gives them, those
 * whose three cells hold the search's text while it holds any. It walks the
 * whole document, so only a mounted check sheet asks for it.
 */
export function checkRows(
  state: RootState,
  search = '',
  i18n: Translator = sourceI18n
): ReadonlyArray<DictionaryCheck> {
  const checks = listDictionaryChecks(state);
  const needle = toSearchText(search.trim());
  if (!needle) return Object.freeze(checks);

  return Object.freeze(
    checks.filter(check =>
      CHECK_COLUMNS.some(({ id }) =>
        toSearchText(checkCellText(state, check, id, i18n)).includes(needle)
      )
    )
  );
}
