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
  tableCase: Case; // ADD: version 0.2.18
  columnCase: Case; // ADD: version 0.2.18
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

export const enum CanvasType {
  ERD = "ERD",
  SQL = "SQL",
  List = "List",
  GeneratorCode = "GeneratorCode",
  Visualization = "Visualization",
}

export const enum Database {
  MariaDB = "MariaDB",
  MSSQL = "MSSQL",
  MySQL = "MySQL",
  Oracle = "Oracle",
  PostgreSQL = "PostgreSQL",
}

export const enum Language {
  graphql = "graphql",
  cs = "cs",
  java = "java",
  kotlin = "kotlin",
  typescript = "typescript",
  JPA = "JPA",
}

export const enum Case {
  none = "none",
  camelCase = "camelCase",
  pascalCase = "pascalCase",
  snakeCase = "snakeCase",
}

export const enum ShowKey {
  tableComment = "tableComment",
  columnComment = "columnComment",
  columnDataType = "columnDataType",
  columnDefault = "columnDefault",
  columnAutoIncrement = "columnAutoIncrement",
  columnPrimaryKey = "columnPrimaryKey",
  columnUnique = "columnUnique",
  columnNotNull = "columnNotNull",
  relationship = "relationship",
}

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
    database: Database.MySQL,
    databaseName: "",
    canvasType: CanvasType.ERD,
    language: Language.graphql,
    tableCase: Case.pascalCase,
    columnCase: Case.camelCase,
  };
}
