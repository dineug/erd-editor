export interface CanvasState {
  width: number;
  height: number;
  scrollTop: number;
  scrollLeft: number;
  show: Show;
  database: Database;
  databaseName: string;
  canvasType: string;
  language: Language; // ADD: version 0.2.16
  tableCase: NameCase; // ADD: version 0.2.18
  columnCase: NameCase; // ADD: version 0.2.18
  setting: Setting; // ADD: version 1.1.0
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
export type ShowKey = keyof Show;

export interface Setting {
  relationshipDataTypeSync: boolean; // ADD: version 1.1.0
  columnOrder: ColumnType[]; // ADD: version 1.1.1
}

export type ColumnType =
  | 'columnUnique'
  | 'columnAutoIncrement'
  | 'columnName'
  | 'columnDataType'
  | 'columnNotNull'
  | 'columnDefault'
  | 'columnComment';

export type CanvasType =
  | 'ERD'
  | 'SQL'
  | 'Grid'
  | 'GeneratorCode'
  | 'Visualization';

export type Database =
  | 'MariaDB'
  | 'MSSQL'
  | 'MySQL'
  | 'Oracle'
  | 'PostgreSQL'
  | 'SQLite';

export type Language =
  | 'GraphQL'
  | 'C#'
  | 'Java'
  | 'Kotlin'
  | 'TypeScript'
  | 'JPA'
  | 'Scala';

export type NameCase = 'none' | 'camelCase' | 'pascalCase' | 'snakeCase';
