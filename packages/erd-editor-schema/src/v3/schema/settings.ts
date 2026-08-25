import { ValuesType } from '@/internal-types';

export type Settings = {
  width: number;
  height: number;
  scrollTop: number;
  scrollLeft: number;
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
  ignoreSaveSettings: number;
};

export const CanvasType = {
  ERD: 'ERD',
  visualization: '@dineug/erd-editor/builtin-visualization',
  schemaSQL: '@dineug/erd-editor/builtin-schema-sql',
  generatorCode: '@dineug/erd-editor/builtin-generator-code',
  settings: 'settings',
} as const;
export type CanvasType = ValuesType<typeof CanvasType>;
export const CanvasTypeList: ReadonlyArray<string> = Object.values(CanvasType);

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

export const SaveSettingType = {
  scroll: 1,
  zoomLevel: 2,
} as const;

export const CANVAS_ZOOM_MIN = 0.1;
export const CANVAS_ZOOM_MAX = 1;
export const CANVAS_SIZE_MIN = 2_000;
export const CANVAS_SIZE_MAX = 20_000;
