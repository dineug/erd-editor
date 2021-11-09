import {
  BracketType,
  CanvasState,
  CanvasType,
  ColumnType,
  Database,
  HighlightTheme,
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
  '@vuerd/builtin-sql-ddl',
  '@vuerd/builtin-grid',
  '@vuerd/builtin-generator-code',
  '@vuerd/builtin-visualization',
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

export const highlightThemes: HighlightTheme[] = [
  'MonokaiSublime',
  'VS2015',
  'AtomOneDark',
  'AtomOneLight',
  'GithubGist',
];

export const bracketTypes: BracketType[] = [
  'none',
  'doubleQuote',
  'singleQuote',
  'backtick',
];

export const bracketTypeMap: Record<BracketType, string> = {
  none: '',
  singleQuote: `'`,
  doubleQuote: `"`,
  backtick: '`',
};

export const createCanvasState = (): CanvasState => ({
  version: import.meta.env.VITE_VUERD_VERSION,
  width: 2000,
  height: 2000,
  scrollTop: 0,
  scrollLeft: 0,
  zoomLevel: 1,
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
  highlightTheme: 'VS2015',
  bracketType: 'none',
  setting: {
    relationshipDataTypeSync: true,
    relationshipOptimization: false,
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
  pluginSerializationMap: {},
});
