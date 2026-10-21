import { ColumnType, NameViewMode, Show } from '@/constants/schema';
import { getLiveDomainName } from '@/engine/modules/dictionary/membership';
import { FocusType, ViewKind } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import type { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

type Settings = RootState['settings'];
type ViewSettings = Pick<Settings, 'nameViewMode' | 'show'>;

/**
 * The name view and the show bits a scene lays its cells out by: the document's
 * settings, and in a view the name view alone, since a view reads no show bit.
 * So a view's type cell stands for the domain in the logical view whatever the Domain bit says.
 */
export const sceneNameSettings = (
  settings: ViewSettings,
  source: GeometrySource = 'document'
): ViewSettings =>
  source === 'document'
    ? settings
    : { nameViewMode: settings.nameViewMode, show: 0 };

/** Whether the document draws each logical name in the place of its name. */
export const isLogicalNameView = ({
  nameViewMode,
}: Pick<Settings, 'nameViewMode'>): boolean =>
  nameViewMode === NameViewMode.logical;

/** Whether the document draws each logical name beside its name. */
export const isBothNameView = ({
  nameViewMode,
}: Pick<Settings, 'nameViewMode'>): boolean =>
  nameViewMode === NameViewMode.both;

/**
 * Whether a logical name cell draws the name in its place: in the logical
 * view while the logical name is blank, dimmed, and measured by the name.
 */
export const drawsNameForLogicalName = (
  settings: Pick<Settings, 'nameViewMode'>,
  { logicalName }: { logicalName: string }
): boolean => isLogicalNameView(settings) && !logicalName.trim();

/** What a label outside the canvas shows of a table's or a column's names. */
export type NameLabel = {
  /** The name it leads with, blank while there is none to show. */
  text: string;
  /** The name after it, muted where it can be: the view of both's own, '' otherwise. */
  after: string;
  /** Whether the text is the name standing in for a blank logical name, which a label dims. */
  standIn: boolean;
};

/**
 * What a label shows in the name view: the logical name in the logical view,
 * the name standing in while it is blank, and in the view of both the logical
 * name with the name after it, or the name alone while the logical one is blank.
 */
export function toNameLabel(
  settings: Pick<Settings, 'nameViewMode'>,
  { name, logicalName }: { name: string; logicalName: string }
): NameLabel {
  const logical = logicalName.trim() ? logicalName : '';

  if (isLogicalNameView(settings)) {
    return logical
      ? { text: logical, after: '', standIn: false }
      : { text: name, after: '', standIn: name.trim() !== '' };
  }
  if (isBothNameView(settings) && logical) {
    return { text: logical, after: name.trim() ? name : '', standIn: false };
  }
  return { text: name, after: '', standIn: false };
}

/**
 * A label as one text, where it cannot set its names apart: the name after
 * the logical name stands in brackets.
 *
 * @example
 * nameLabelText({ text: 'Member', after: 'member', standIn: false }); // 'Member (member)'
 */
export const nameLabelText = ({ text, after }: NameLabel): string =>
  after ? `${text} (${after})` : text;

/**
 * Whether a document row's type cell stands for its domain: in the logical
 * view while the domain has no cell of its own, so a row never draws the
 * domain twice. It then shows the domain's name, or the type while it has none.
 */
export const isDomainInTypeCell = (settings: ViewSettings): boolean =>
  isLogicalNameView(settings) && !bHas(settings.show, Show.columnDomain);

/**
 * Whether one row's type cell draws its column's domain: while the cell stands
 * for the domain in the source's scene and the column links one the document
 * lists by a name. Otherwise it draws the type, and is measured by it.
 */
export const drawsDomainInTypeCell = (
  state: RootState,
  column: Pick<Column, 'domainId'>,
  source: GeometrySource = 'document'
): boolean =>
  isDomainInTypeCell(sceneNameSettings(state.settings, source)) &&
  getLiveDomainName(state, column.domainId) !== '';

/**
 * The cells a document table header lays out, in order: the name, the
 * logical name in its place in the logical view or before it in the view of
 * both, then the comment while it shows.
 */
export function getTableFocusTypes(settings: ViewSettings): FocusType[] {
  const names = isLogicalNameView(settings)
    ? [FocusType.tableLogicalName]
    : isBothNameView(settings)
      ? [FocusType.tableLogicalName, FocusType.tableName]
      : [FocusType.tableName];

  return bHas(settings.show, Show.tableComment)
    ? [...names, FocusType.tableComment]
    : names;
}

const shownBy =
  (bit: number) =>
  ({ show }: ViewSettings): boolean =>
    bHas(show, bit);

/**
 * Whether a document row lays out the cell of each column type: the name
 * always, the logical name in the view of both names alone, and every other
 * cell, the domain among them, while its show bit is set.
 */
export const ColumnTypeShown: Readonly<
  Record<number, (settings: ViewSettings) => boolean>
> = {
  [ColumnType.columnName]: () => true,
  [ColumnType.columnLogicalName]: isBothNameView,
  [ColumnType.columnDataType]: shownBy(Show.columnDataType),
  [ColumnType.columnDomain]: shownBy(Show.columnDomain),
  [ColumnType.columnNotNull]: shownBy(Show.columnNotNull),
  [ColumnType.columnUnique]: shownBy(Show.columnUnique),
  [ColumnType.columnAutoIncrement]: shownBy(Show.columnAutoIncrement),
  [ColumnType.columnDefault]: shownBy(Show.columnDefault),
  [ColumnType.columnComment]: shownBy(Show.columnComment),
};

/** The focus each column type's cell takes in the physical view. */
const COLUMN_FOCUS_TYPES: Readonly<Record<number, FocusType>> = {
  [ColumnType.columnName]: FocusType.columnName,
  [ColumnType.columnLogicalName]: FocusType.columnLogicalName,
  [ColumnType.columnDataType]: FocusType.columnDataType,
  [ColumnType.columnDomain]: FocusType.columnDomain,
  [ColumnType.columnNotNull]: FocusType.columnNotNull,
  [ColumnType.columnUnique]: FocusType.columnUnique,
  [ColumnType.columnAutoIncrement]: FocusType.columnAutoIncrement,
  [ColumnType.columnDefault]: FocusType.columnDefault,
  [ColumnType.columnComment]: FocusType.columnComment,
};

/**
 * The focus a document cell takes in the name view, given the one it takes in
 * the physical view: the logical view edits the logical name in the name cell
 * and, while the type cell stands for the domain, the domain there.
 */
export function toNameViewFocusType(
  settings: ViewSettings,
  focusType: FocusType
): FocusType {
  if (isLogicalNameView(settings)) {
    if (focusType === FocusType.tableName) return FocusType.tableLogicalName;
    if (focusType === FocusType.columnName) return FocusType.columnLogicalName;
  }
  if (focusType === FocusType.columnDataType && isDomainInTypeCell(settings)) {
    return FocusType.columnDomain;
  }
  return focusType;
}

/** The focus types of a document row's cells, in the order the settings put them. */
export function getColumnFocusTypes(
  settings: Pick<Settings, 'nameViewMode' | 'show' | 'columnOrder'>
): FocusType[] {
  const types: FocusType[] = [];

  for (const columnType of settings.columnOrder) {
    const focusType = COLUMN_FOCUS_TYPES[columnType];
    // A column type this release does not know lays out no cell.
    if (focusType && ColumnTypeShown[columnType](settings)) {
      types.push(toNameViewFocusType(settings, focusType));
    }
  }

  return types;
}

/**
 * The cells a view row lays out, whatever the show bits or the column order:
 * the name and the type, which the logical view fills its own way, and in the
 * view of both the logical name before them and the domain before the type.
 */
export function getViewColumnTypes(
  settings: Pick<Settings, 'nameViewMode'>
): number[] {
  return isBothNameView(settings)
    ? [
        ColumnType.columnLogicalName,
        ColumnType.columnName,
        ColumnType.columnDomain,
        ColumnType.columnDataType,
      ]
    : [ColumnType.columnName, ColumnType.columnDataType];
}

/** The focus types of a view row's cells, in that order. */
export function getViewColumnFocusTypes(settings: ViewSettings): FocusType[] {
  const shown = sceneNameSettings(settings, ViewKind.flow);

  return getViewColumnTypes(settings).map(columnType =>
    toNameViewFocusType(shown, COLUMN_FOCUS_TYPES[columnType])
  );
}

/** The physical view's cell in the place of each cell the name view adds. */
const PHYSICAL_FOCUS_TYPES: Partial<Record<FocusType, FocusType>> = {
  [FocusType.tableLogicalName]: FocusType.tableName,
  [FocusType.columnLogicalName]: FocusType.columnName,
  [FocusType.columnDomain]: FocusType.columnDataType,
};

/**
 * Where a header or a row of the given cells shows a focus type: on its own
 * cell, else on the cell the name view draws in its place, the name and the
 * logical name standing in for each other, as the type and the domain do.
 */
export function toShownFocusType(
  settings: ViewSettings,
  types: ReadonlyArray<FocusType>,
  focusType: FocusType
): FocusType | null {
  if (types.includes(focusType)) return focusType;

  const shown = toNameViewFocusType(
    settings,
    PHYSICAL_FOCUS_TYPES[focusType] ?? focusType
  );
  return types.includes(shown) ? shown : null;
}

/**
 * Moves the focus onto the cell that shows it once the name view or the Domain
 * bit changed, the logical name's cell for the name's, and closes an editor it
 * moves off. A focus neither cell of its pair shows is left as a hidden bit leaves it.
 */
export function keepFocusShown(state: RootState): void {
  const { focusTable } = state.editor;
  if (!focusTable) return;

  const types = focusTable.columnId
    ? getColumnFocusTypes(state.settings)
    : getTableFocusTypes(state.settings);
  const shown = toShownFocusType(state.settings, types, focusTable.focusType);
  if (!shown || shown === focusTable.focusType) return;

  focusTable.focusType = shown;
  focusTable.edit = false;
}
