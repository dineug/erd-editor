import { ValuesType } from '@/internal-types';

export interface CanvasEntity {
  version: string; // ADD: version 2.0.0
  width: number;
  height: number;
  scrollTop: number;
  scrollLeft: number;
  zoomLevel: number; // ADD: version 2.0.0
  show: Show;
  database: Database;
  databaseName: string;
  canvasType: string;
  language: Language; // ADD: version 0.2.16
  tableCase: NameCase; // ADD: version 0.2.18
  columnCase: NameCase; // ADD: version 0.2.18
  highlightTheme: HighlightTheme; // ADD: version 2.0.0
  bracketType: BracketType; // ADD: version 2.0.11
  setting: Setting; // ADD: version 1.1.0
  pluginSerializationMap: Record<string, string>; // ADD: version 2.2.3
}

export interface Show {
  tableComment: boolean;
  columnComment: boolean;
  columnDataType: boolean;
  columnDefault: boolean;
  columnAutoIncrement: boolean;
  columnPrimaryKey: boolean;
  columnUnique: boolean;
  columnNotNull: boolean;
  relationship: boolean;
}

export interface Setting {
  relationshipDataTypeSync: boolean; // ADD: version 1.1.0
  relationshipOptimization: boolean; // ADD: version 2.2.10
  columnOrder: ColumnType[]; // ADD: version 1.1.1
}

export const ColumnType = {
  columnUnique: 'columnUnique',
  columnAutoIncrement: 'columnAutoIncrement',
  columnName: 'columnName',
  columnDataType: 'columnDataType',
  columnNotNull: 'columnNotNull',
  columnDefault: 'columnDefault',
  columnComment: 'columnComment',
} as const;
export type ColumnType = ValuesType<typeof ColumnType>;
export const ColumnTypeList: ReadonlyArray<string> = Object.values(ColumnType);

export const CanvasType = {
  ERD: 'ERD',
  '@vuerd/builtin-sql-ddl': '@vuerd/builtin-sql-ddl',
  '@vuerd/builtin-grid': '@vuerd/builtin-grid',
  '@vuerd/builtin-generator-code': '@vuerd/builtin-generator-code',
  '@vuerd/builtin-visualization': '@vuerd/builtin-visualization',
} as const;
export type CanvasType = ValuesType<typeof CanvasType>;
export const CanvasTypeList: ReadonlyArray<string> = Object.values(CanvasType);

export const Database = {
  MariaDB: 'MariaDB',
  MSSQL: 'MSSQL',
  MySQL: 'MySQL',
  Oracle: 'Oracle',
  PostgreSQL: 'PostgreSQL',
  SQLite: 'SQLite',
} as const;
export type Database = ValuesType<typeof Database>;
export const DatabaseList: ReadonlyArray<string> = Object.values(Database);

export const Language = {
  GraphQL: 'GraphQL',
  'C#': 'C#',
  Java: 'Java',
  Kotlin: 'Kotlin',
  TypeScript: 'TypeScript',
  JPA: 'JPA',
  Scala: 'Scala',
} as const;
export type Language = ValuesType<typeof Language>;
export const LanguageList: ReadonlyArray<string> = Object.values(Language);

export const NameCase = {
  none: 'none',
  camelCase: 'camelCase',
  pascalCase: 'pascalCase',
  snakeCase: 'snakeCase',
} as const;
export type NameCase = ValuesType<typeof NameCase>;
export const NameCaseList: ReadonlyArray<string> = Object.values(NameCase);

export const HighlightTheme = {
  AtomOneDark: 'AtomOneDark',
  AtomOneLight: 'AtomOneLight',
  MonokaiSublime: 'MonokaiSublime',
  GithubGist: 'GithubGist',
  VS2015: 'VS2015',
} as const;
export type HighlightTheme = ValuesType<typeof HighlightTheme>;
export const HighlightThemeList: ReadonlyArray<string> =
  Object.values(HighlightTheme);

export const BracketType = {
  none: 'none',
  doubleQuote: 'doubleQuote',
  singleQuote: 'singleQuote',
  backtick: 'backtick',
} as const;
export type BracketType = ValuesType<typeof BracketType>;
export const BracketTypeList: ReadonlyArray<string> =
  Object.values(BracketType);
