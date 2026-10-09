import { ValuesType } from '@/internal-types';

export type Settings = {
  width: number;
  height: number;
  /**
   * The legacy view offset every released editor reads, measured from the
   * canvas box centred in the viewport. The parser reads the pair once to
   * migrate a document that carries no origin; nothing else ever writes it.
   */
  scrollTop: number;
  scrollLeft: number;
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
  relationshipOptimization: boolean;
  columnOrder: number[];
  maxWidthComment: number;
  /**
   * The LockSettingType bits of the settings a document saves as they stood
   * when locked; every other setting is saved as it stands.
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
};

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
>;

export const CanvasType = {
  ERD: 'ERD',
  visualization: '@dineug/erd-editor/builtin-visualization',
  schemaSQL: '@dineug/erd-editor/builtin-schema-sql',
  generatorCode: '@dineug/erd-editor/builtin-generator-code',
  settings: 'settings',
} as const;
export type CanvasType = ValuesType<typeof CanvasType>;
export const CanvasTypeList: ReadonlyArray<string> = Object.values(CanvasType);

// Append only, like the lists below. columnAlternateKey is off in documents that
// predate it, so a diagram keeps its layout; hideReferentialAction reads the other
// way round, so every document shows the action labels on connectors at first.
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
} as const;

export const ColumnType = {
  columnName: 1,
  columnDataType: 2,
  columnNotNull: 4,
  columnUnique: 8,
  columnAutoIncrement: 16,
  columnDefault: 32,
  columnComment: 64,
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

/**
 * The bits of ignoreSaveSettings, the field releases before the locks read:
 * toJson writes both while the viewport is locked and neither while it is not.
 */
export const SaveSettingType = {
  scroll: 1,
  zoomLevel: 2,
} as const;

// Append only, like the lists above. The viewport locks the origin and the zoom
// together, since an origin saved without its zoom opens on another place.
export const LockSettingType = {
  viewport: 1,
  canvasType: 2,
  language: 4,
  tableNameCase: 8,
  columnNameCase: 16,
  bracketType: 32,
} as const;
export const LockSettingTypeList: ReadonlyArray<number> =
  Object.values(LockSettingType);

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
};

export const CANVAS_ZOOM_MIN = 0.1;
export const CANVAS_ZOOM_MAX = 1.5;
export const CANVAS_SIZE_MIN = 2_000;
export const CANVAS_SIZE_MAX = 20_000;
