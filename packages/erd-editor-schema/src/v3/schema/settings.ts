import { ValuesType } from '@/internal-types';
import { bHas } from '@/utils/bit';

export type Settings = {
  /**
   * The live view: the screen point scene (0, 0) lands on.
   */
  originX: number;
  originY: number;
  zoomLevel: number;
  show: number;
  database: number;
  databaseName: string;
  canvasType: string;
  language: number;
  tableNameCase: number;
  columnNameCase: number;
  bracketType: number;
  relationshipDataTypeSync: boolean;
  columnOrder: number[];
  maxWidthComment: number;
  /**
   * The LockSettingType bits of the settings a document saves as they stood
   * when locked, every other saved as it stands; the name view's bit is set
   * while it is unlocked instead.
   */
  lockSettings: number;
  /**
   * What each locked setting saves, held in memory alone: toJson writes it over
   * the live value, and a parse takes it from the saved fields.
   */
  lockedValues: LockedValues;
  /**
   * The Schema SQL scripts; a file saves the key only while one of them holds
   * text.
   */
  ddlScripts: DDLScripts;
  /**
   * The names a diagram shows; a file saves it last, at its lock's value while
   * locked, and only while what it saves is not physical.
   */
  nameViewMode: NameViewMode;
};

/** The names a diagram shows: the physical ones, the logical ones or both. */
export const NameViewMode = {
  physical: 'physical',
  logical: 'logical',
  both: 'both',
} as const;
export type NameViewMode = ValuesType<typeof NameViewMode>;
export const NameViewModeList: ReadonlyArray<NameViewMode> =
  Object.values(NameViewMode);

export type DDLScripts = {
  /**
   * SQL written as is after the header and before the tables, for every
   * database.
   */
  before: string;
  /** SQL written as is after the generated DDL, for every database. */
  after: string;
};

/** Where a Schema SQL script goes: ahead of the tables or past the DDL. */
export const DDLScriptPosition = {
  before: 'before',
  after: 'after',
} as const;
export type DDLScriptPosition = ValuesType<typeof DDLScriptPosition>;
export const DDLScriptPositionList: ReadonlyArray<DDLScriptPosition> =
  Object.values(DDLScriptPosition);

export type LockedValues = Pick<
  Settings,
  | 'originX'
  | 'originY'
  | 'zoomLevel'
  | 'canvasType'
  | 'language'
  | 'tableNameCase'
  | 'columnNameCase'
  | 'bracketType'
  | 'nameViewMode'
>;

export const CanvasType = {
  ERD: 'ERD',
  visualization: '@dineug/erd-editor/builtin-visualization',
  schemaSQL: '@dineug/erd-editor/builtin-schema-sql',
  generatorCode: '@dineug/erd-editor/builtin-generator-code',
  settings: 'settings',
  dictionary: '@dineug/erd-editor/builtin-dictionary',
} as const;
export type CanvasType = ValuesType<typeof CanvasType>;
export const CanvasTypeList: ReadonlyArray<string> = Object.values(CanvasType);

// Append only, like the lists below. columnAlternateKey and columnDomain stay
// off where a document lacks them, so a diagram keeps its layout; the hide bits
// read the other way round, so a document shows labels, groups and memos first.
export const Show = {
  tableComment: 1,
  columnComment: 2,
  columnDataType: 4,
  columnDefault: 8,
  columnAutoIncrement: 16,
  columnPrimaryKey: 32,
  columnUnique: 64,
  columnNotNull: 128,
  relationship: 256,
  columnAlternateKey: 512,
  hideReferentialAction: 1024,
  hideTableGroup: 2048,
  hideMemo: 4096,
  columnDomain: 8192,
} as const;

// Append only. A document saves the order in seven entries while the logical
// name and the domain stand where a parse puts them into an older one.
export const ColumnType = {
  columnName: 1,
  columnDataType: 2,
  columnNotNull: 4,
  columnUnique: 8,
  columnAutoIncrement: 16,
  columnDefault: 32,
  columnComment: 64,
  columnLogicalName: 128,
  columnDomain: 256,
} as const;
export const ColumnTypeList: ReadonlyArray<number> = Object.values(ColumnType);

// Append only. A stored document holds the number, so reordering these
// remaps every diagram already saved.
export const Database = {
  MariaDB: 1,
  MSSQL: 2,
  MySQL: 4,
  Oracle: 8,
  PostgreSQL: 16,
  SQLite: 32,
  Databricks: 64,
  Snowflake: 128,
} as const;
export const DatabaseList: ReadonlyArray<number> = Object.values(Database);

// Append only. A stored document holds the number, so reordering these
// remaps every diagram already saved.
export const Language = {
  GraphQL: 1,
  csharp: 2,
  Java: 4,
  Kotlin: 8,
  TypeScript: 16,
  JPA: 32,
  Scala: 64,
  Go: 128,
  SQLAlchemy: 256,
  TypeORM: 512,
  Sequelize: 1024,
  Drizzle: 2048,
  DBML: 4096,
  AML: 8192,
  Mermaid: 16384,
  PHP: 32768,
  Doctrine: 65536,
  Rust: 131072,
  SeaORM: 262144,
  Swift: 524288,
  Zod: 1048576,
  JSONSchema: 2097152,
} as const;
export const LanguageList: ReadonlyArray<number> = Object.values(Language);

export const NameCase = {
  none: 1,
  camelCase: 2,
  pascalCase: 4,
  snakeCase: 8,
} as const;
export const NameCaseList: ReadonlyArray<number> = Object.values(NameCase);

export const BracketType = {
  none: 1,
  doubleQuote: 2,
  singleQuote: 4,
  backtick: 8,
} as const;
export const BracketTypeList: ReadonlyArray<number> =
  Object.values(BracketType);

// Append only, like the lists above. The viewport locks the origin and the zoom
// together, since an origin saved without its zoom opens on another place. The
// name view's bit reads the other way round, so a file without it opens locked.
export const LockSettingType = {
  viewport: 1,
  canvasType: 2,
  language: 4,
  tableNameCase: 8,
  columnNameCase: 16,
  bracketType: 32,
  unlockNameViewMode: 64,
} as const;
export type LockSettingType =
  (typeof LockSettingType)[keyof typeof LockSettingType];
export const LockSettingTypeList: ReadonlyArray<LockSettingType> =
  Object.values(LockSettingType);

/**
 * The lock bits that unlock their setting while set, as the hide bits of Show
 * hide while set: a document saved before one holds it clear, and so locked.
 */
export const InvertedLockSettings: number = LockSettingType.unlockNameViewMode;

/** The fields each lock holds. */
export const LockSettingFields: Readonly<
  Record<number, ReadonlyArray<keyof LockedValues>>
> = {
  [LockSettingType.viewport]: ['originX', 'originY', 'zoomLevel'],
  [LockSettingType.canvasType]: ['canvasType'],
  [LockSettingType.language]: ['language'],
  [LockSettingType.tableNameCase]: ['tableNameCase'],
  [LockSettingType.columnNameCase]: ['columnNameCase'],
  [LockSettingType.bracketType]: ['bracketType'],
  [LockSettingType.unlockNameViewMode]: ['nameViewMode'],
};

const assertSingleBit = (bit: number): void => {
  if (!Number.isInteger(bit) || bit <= 0 || (bit & (bit - 1)) !== 0) {
    throw new RangeError(`A lock is one bit, not ${bit}`);
  }
};

/**
 * Whether the lock of one bit is on, an inverted bit locking while it is clear.
 * A mask of several bits throws, since each bit of it may read its own way.
 */
export function isSettingLocked(
  lockSettings: number,
  bit: LockSettingType
): boolean {
  assertSingleBit(bit);
  return bHas(lockSettings, bit) !== bHas(InvertedLockSettings, bit);
}

/**
 * The lock bits with the lock of one bit turned on or off, an inverted bit
 * cleared to lock and set to unlock. A mask of several bits throws.
 */
export function setSettingLock(
  lockSettings: number,
  bit: LockSettingType,
  locked: boolean
): number {
  assertSingleBit(bit);
  return locked !== bHas(InvertedLockSettings, bit)
    ? lockSettings | bit
    : lockSettings & ~bit;
}

export const CANVAS_ZOOM_MIN = 0.1;
export const CANVAS_ZOOM_MAX = 1.5;
export const CANVAS_SIZE_MIN = 2_000;
export const CANVAS_SIZE_MAX = 20_000;
