import {
  clamp,
  difference,
  isBoolean,
  isNil,
  isNumber,
  isPlainObject,
  isString,
  pick,
} from 'es-toolkit';

import { assign, validNumber, validString } from '@/helper';
import { DeepPartial } from '@/internal-types';
import {
  type LegacyScrollBox,
  migrateScrollToOrigin,
} from '@/v3/parser/migrateScroll';
import {
  BracketType,
  BracketTypeList,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  CanvasType,
  ColumnType,
  ColumnTypeList,
  Database,
  DatabaseList,
  InvertedLockSettings,
  isSettingLocked,
  Language,
  LanguageList,
  LockedValues,
  LockSettingFields,
  LockSettingType,
  LockSettingTypeList,
  NameCase,
  NameCaseList,
  NameViewMode,
  NameViewModeList,
  Settings,
  Show,
} from '@/v3/schema/settings';

const defaultShow =
  Show.tableComment |
  Show.columnComment |
  Show.columnDataType |
  Show.columnDefault |
  Show.columnPrimaryKey |
  Show.columnNotNull |
  Show.relationship;

/** Every lock on: each bit set but the inverted ones, which lock while clear. */
const LOCK_ALL =
  LockSettingTypeList.reduce((acc, bit) => acc | bit, 0) &
  ~InvertedLockSettings;

const LOCKED_FIELDS = LockSettingTypeList.flatMap(
  bit => LockSettingFields[bit]
);

/**
 * What the lockable settings hold now, which is what a document saved them as
 * when it was just parsed.
 */
export const toLockedValues = (settings: LockedValues): LockedValues =>
  pick(settings, LOCKED_FIELDS);

const createSettings = (): Settings => {
  const settings: Omit<Settings, 'lockedValues'> = {
    originX: 0,
    originY: 0,
    zoomLevel: 1,
    show: defaultShow,
    database: Database.MySQL,
    databaseName: '',
    canvasType: CanvasType.ERD,
    language: Language.GraphQL,
    tableNameCase: NameCase.pascalCase,
    columnNameCase: NameCase.camelCase,
    bracketType: BracketType.none,
    relationshipDataTypeSync: true,
    columnOrder: [
      ColumnType.columnLogicalName,
      ColumnType.columnName,
      ColumnType.columnDataType,
      ColumnType.columnDomain,
      ColumnType.columnNotNull,
      ColumnType.columnUnique,
      ColumnType.columnAutoIncrement,
      ColumnType.columnDefault,
      ColumnType.columnComment,
    ],
    maxWidthComment: -1,
    lockSettings: LOCK_ALL,
    ddlScripts: { before: '', after: '' },
    nameViewMode: NameViewMode.physical,
  };
  return { ...settings, lockedValues: toLockedValues(settings) };
};

/** The column types of a document saved before the logical name and domain. */
const SEVEN_COLUMN_TYPES = ColumnTypeList.filter(
  columnType =>
    columnType !== ColumnType.columnLogicalName &&
    columnType !== ColumnType.columnDomain
);

const isOrderOf = (
  columnTypes: ReadonlyArray<number>,
  order: ReadonlyArray<unknown>
) =>
  order.length === columnTypes.length &&
  difference(columnTypes, order as number[]).length === 0;

/**
 * A saved column order as the full one: seven entries take the logical name
 * just before the name and the domain just after the data type, every column
 * type in any order stays as it is, and anything else is null.
 */
export function toFullColumnOrder(order: unknown): number[] | null {
  if (!Array.isArray(order)) return null;
  if (isOrderOf(ColumnTypeList, order)) return order;
  if (!isOrderOf(SEVEN_COLUMN_TYPES, order)) return null;

  return order.flatMap((columnType: number) =>
    columnType === ColumnType.columnName
      ? [ColumnType.columnLogicalName, columnType]
      : columnType === ColumnType.columnDataType
        ? [columnType, ColumnType.columnDomain]
        : [columnType]
  );
}

/**
 * The column order a document saves: seven entries while the logical name and
 * the domain stand where toFullColumnOrder would put them, so a file that never
 * moved them keeps its bytes and an older release keeps its order.
 */
export function toSavedColumnOrder(order: number[]): number[] {
  if (!Array.isArray(order)) return order;

  const seven = order.filter(
    columnType =>
      columnType !== ColumnType.columnLogicalName &&
      columnType !== ColumnType.columnDomain
  );
  const full = toFullColumnOrder(seven);

  return full?.length === order.length &&
    full.every((columnType, index) => columnType === order[index])
    ? seven
    : order;
}

const LEGACY_CANVAS_SIZE = 2000;

const isFiniteNumber = (value: unknown): value is number =>
  Number.isFinite(value);

const sizeInRange = (value: number) =>
  clamp(value, CANVAS_SIZE_MIN, CANVAS_SIZE_MAX);
const zoomInRange = (value: number) =>
  clamp(value, CANVAS_ZOOM_MIN, CANVAS_ZOOM_MAX);
const maxWidthCommentInRange = (value: number) => clamp(value, 60, 200);

/**
 * The canvas box and scroll pair of a document saved before the origin, read
 * off its raw settings since no parsed field holds them: each size clamped as
 * it was then, a missing field at the default it had.
 */
function toLegacyScrollBox(
  json: Record<string, unknown>,
  zoomLevel: number
): LegacyScrollBox {
  const size = (value: unknown) =>
    isNumber(value) ? sizeInRange(value) : LEGACY_CANVAS_SIZE;
  const scroll = (value: unknown) => (isNumber(value) ? value : 0);

  return {
    width: size(json.width),
    height: size(json.height),
    zoomLevel,
    scrollLeft: scroll(json.scrollLeft),
    scrollTop: scroll(json.scrollTop),
  };
}

export function createAndMergeSettings(json?: DeepPartial<Settings>): Settings {
  const settings = createSettings();
  if (!isPlainObject(json) || isNil(json)) return settings;

  const assignNumber = assign(isNumber, settings, json);
  const assignString = assign(isString, settings, json);
  const assignBoolean = assign(isBoolean, settings, json);

  if (isNumber(json.zoomLevel)) {
    settings.zoomLevel = zoomInRange(json.zoomLevel);
  }
  if (isNumber(json.maxWidthComment) && json.maxWidthComment !== -1) {
    settings.maxWidthComment = maxWidthCommentInRange(json.maxWidthComment);
  }

  assignNumber('show');
  assignString('databaseName');
  assignString('canvasType');
  assignBoolean('relationshipDataTypeSync');

  assign(validNumber(DatabaseList), settings, json)('database');
  assign(validNumber(LanguageList), settings, json)('language');
  assign(validNumber(NameCaseList), settings, json)('tableNameCase');
  assign(validNumber(NameCaseList), settings, json)('columnNameCase');
  assign(validNumber(BracketTypeList), settings, json)('bracketType');
  assign(validString(NameViewModeList), settings, json)('nameViewMode');

  settings.columnOrder =
    toFullColumnOrder(json.columnOrder) ?? settings.columnOrder;

  if (isFiniteNumber(json.originX) && isFiniteNumber(json.originY)) {
    settings.originX = json.originX;
    settings.originY = json.originY;
  } else {
    const { originX, originY } = migrateScrollToOrigin(
      toLegacyScrollBox(json, settings.zoomLevel)
    );
    settings.originX = originX;
    settings.originY = originY;
  }

  if (isNumber(json.lockSettings)) {
    // Every bit, unknown ones too as with show, so a lock a later release adds
    // outlives a save by this one; made only the int32 a bit test reads.
    settings.lockSettings = json.lockSettings | 0;
    // A tab no editor locks, which only a hand edit can have written.
    if (
      isSettingLocked(settings.lockSettings, LockSettingType.canvasType) &&
      settings.canvasType === CanvasType.settings
    ) {
      settings.canvasType = CanvasType.ERD;
    }
    settings.lockedValues = toLockedValues(settings);
  } else {
    resetPreLockView(settings);
  }

  const assignScript = assign(isString, settings.ddlScripts, json.ddlScripts);
  assignScript('before');
  assignScript('after');

  return settings;
}

/**
 * A document saved before the locks, every one of which it opens with on:
 * its view and tab start where a new document's do, since what it saved of
 * them was only where its last reader stood.
 */
export function resetPreLockView(settings: Settings): void {
  const { originX, originY, zoomLevel, canvasType } = createSettings();
  Object.assign(settings, { originX, originY, zoomLevel, canvasType });
  settings.lockedValues = toLockedValues(settings);
}
