import {
  CanvasState,
  ColumnType,
  CanvasType,
  Database,
  Language,
  NameCase,
} from '@@types/engine/store/canvas.state';

export const columnTypes: ColumnType[] = [
  'columnUnique',
  'columnAutoIncrement',
  'columnName',
  'columnDataType',
  'columnNotNull',
  'columnDefault',
  'columnComment',
];

export const canvasTypeList: CanvasType[] = [
  'ERD',
  'SQL',
  'Grid',
  'GeneratorCode',
  'Visualization',
];

export const databaseList: Database[] = [
  'MariaDB',
  'MSSQL',
  'MySQL',
  'Oracle',
  'PostgreSQL',
  'SQLite',
];

export const languageList: Language[] = [
  'GraphQL',
  'C#',
  'Java',
  'Kotlin',
  'TypeScript',
  'JPA',
  'Scala',
];

export const nameCaseList: NameCase[] = [
  'none',
  'camelCase',
  'pascalCase',
  'snakeCase',
];

export const createCanvasState = (): CanvasState => ({
  width: 2000,
  height: 2000,
  scrollTop: 0,
  scrollLeft: 0,
  show: {
    tableComment: true,
    columnComment: true,
    columnDataType: true,
    columnDefault: true,
    columnAutoIncrement: false,
    columnPrimaryKey: true,
    columnUnique: false,
    columnNotNull: true,
    relationship: true,
  },
  database: 'MySQL',
  databaseName: '',
  canvasType: 'ERD',
  language: 'GraphQL',
  tableCase: 'pascalCase',
  columnCase: 'camelCase',
  setting: {
    relationshipDataTypeSync: true,
    columnOrder: [
      'columnName',
      'columnDataType',
      'columnNotNull',
      'columnUnique',
      'columnAutoIncrement',
      'columnDefault',
      'columnComment',
    ],
  },
});
