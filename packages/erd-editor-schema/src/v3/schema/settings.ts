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
};

export const CanvasType = {
  ERD: 'ERD',
  visualization: '@dineug/builtin-visualization',
  schemaSQL: '@dineug/builtin-schema-sql',
  generatorCode: '@dineug/builtin-generator-code',
} as const;
export type CanvasType = ValuesType<typeof CanvasType>;
export const CanvasTypeList: ReadonlyArray<string> = Object.values(CanvasType);

export const Show = {
  tableComment: /*        */ 0b0000000000000000000000000000001,
  columnComment: /*       */ 0b0000000000000000000000000000010,
  columnDataType: /*      */ 0b0000000000000000000000000000100,
  columnDefault: /*       */ 0b0000000000000000000000000001000,
  columnAutoIncrement: /* */ 0b0000000000000000000000000010000,
  columnPrimaryKey: /*    */ 0b0000000000000000000000000100000,
  columnUnique: /*        */ 0b0000000000000000000000001000000,
  columnNotNull: /*       */ 0b0000000000000000000000010000000,
  relationship: /*        */ 0b0000000000000000000000100000000,
} as const;

export const ColumnType = {
  columnName: /*          */ 0b0000000000000000000000000000001,
  columnDataType: /*      */ 0b0000000000000000000000000000010,
  columnNotNull: /*       */ 0b0000000000000000000000000000100,
  columnUnique: /*        */ 0b0000000000000000000000000001000,
  columnAutoIncrement: /* */ 0b0000000000000000000000000010000,
  columnDefault: /*       */ 0b0000000000000000000000000100000,
  columnComment: /*       */ 0b0000000000000000000000001000000,
} as const;
export const ColumnTypeList: ReadonlyArray<number> = Object.values(ColumnType);

export const Database = {
  MariaDB: /*    */ 0b0000000000000000000000000000001,
  MSSQL: /*      */ 0b0000000000000000000000000000010,
  MySQL: /*      */ 0b0000000000000000000000000000100,
  Oracle: /*     */ 0b0000000000000000000000000001000,
  PostgreSQL: /* */ 0b0000000000000000000000000010000,
  SQLite: /*     */ 0b0000000000000000000000000100000,
} as const;
export const DatabaseList: ReadonlyArray<number> = Object.values(Database);

export const Language = {
  GraphQL: /*    */ 0b0000000000000000000000000000001,
  csharp: /*     */ 0b0000000000000000000000000000010,
  Java: /*       */ 0b0000000000000000000000000000100,
  Kotlin: /*     */ 0b0000000000000000000000000001000,
  TypeScript: /* */ 0b0000000000000000000000000010000,
  JPA: /*        */ 0b0000000000000000000000000100000,
  Scala: /*      */ 0b0000000000000000000000001000000,
} as const;
export const LanguageList: ReadonlyArray<number> = Object.values(Language);

export const NameCase = {
  none: /*       */ 0b0000000000000000000000000000001,
  camelCase: /*  */ 0b0000000000000000000000000000010,
  pascalCase: /* */ 0b0000000000000000000000000000100,
  snakeCase: /*  */ 0b0000000000000000000000000001000,
} as const;
export const NameCaseList: ReadonlyArray<number> = Object.values(NameCase);

export const BracketType = {
  none: /*        */ 0b0000000000000000000000000000001,
  doubleQuote: /* */ 0b0000000000000000000000000000010,
  singleQuote: /* */ 0b0000000000000000000000000000100,
  backtick: /*    */ 0b0000000000000000000000000001000,
} as const;
export const BracketTypeList: ReadonlyArray<number> =
  Object.values(BracketType);

export const CANVAS_ZOOM_MIN = 0.1;
export const CANVAS_ZOOM_MAX = 1;
export const CANVAS_SIZE_MIN = 2_000;
export const CANVAS_SIZE_MAX = 20_000;
