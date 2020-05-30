export interface CanvasState {
  width: number;
  height: number;
  scrollTop: number;
  scrollLeft: number;
  show: Show;
  database: Database;
  databaseName: string;
  canvasType: CanvasType;
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
  columnOrder: ColumnType[];
}

export type ColumnType =
  | "columnName"
  | "columnDataType"
  | "columnNotNull"
  | "columnDefault"
  | "columnComment";

export const columnTypes: ColumnType[] = [
  "columnName",
  "columnDataType",
  "columnNotNull",
  "columnDefault",
  "columnComment",
];

export type CanvasType =
  | "ERD"
  | "SQL"
  | "Grid"
  | "GeneratorCode"
  | "Visualization";
export const canvasTypeList: CanvasType[] = [
  "ERD",
  "SQL",
  "Grid",
  "GeneratorCode",
  "Visualization",
];

export type Database = "MariaDB" | "MSSQL" | "MySQL" | "Oracle" | "PostgreSQL";
export const databaseList: Database[] = [
  "MariaDB",
  "MSSQL",
  "MySQL",
  "Oracle",
  "PostgreSQL",
];

export type Language =
  | "GraphQL"
  | "C#"
  | "Java"
  | "Kotlin"
  | "TypeScript"
  | "JPA";
export const languageList: Language[] = [
  "GraphQL",
  "C#",
  "Java",
  "Kotlin",
  "TypeScript",
  "JPA",
];

export type NameCase = "none" | "camelCase" | "pascalCase" | "snakeCase";
export const nameCaseList: NameCase[] = [
  "none",
  "camelCase",
  "pascalCase",
  "snakeCase",
];

export function createCanvasState(): CanvasState {
  return {
    width: 2000,
    height: 2000,
    scrollTop: 0,
    scrollLeft: 0,
    show: {
      tableComment: true,
      columnComment: true,
      columnDataType: true,
      columnDefault: true,
      columnAutoIncrement: true,
      columnPrimaryKey: true,
      columnUnique: true,
      columnNotNull: true,
      relationship: true,
    },
    database: "MySQL",
    databaseName: "",
    canvasType: "ERD",
    language: "GraphQL",
    tableCase: "pascalCase",
    columnCase: "camelCase",
    setting: {
      relationshipDataTypeSync: true,
      columnOrder: [
        "columnName",
        "columnDataType",
        "columnNotNull",
        "columnDefault",
        "columnComment",
      ],
    },
  };
}
