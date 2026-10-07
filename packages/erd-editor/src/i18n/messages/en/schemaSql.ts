/**
 * The Schema SQL tab's options panel, its menu and its buttons. The statements
 * and the headers keep their names in every language, so they have no key.
 */
export const schemaSql = {
  'schemaSql.savedInDocument': 'Saved in the document',
  'schemaSql.thisWindowOnly': 'This window only',
  'schemaSql.statements': 'Statements',
  'schemaSql.header': 'Header',
  'schemaSql.notInDatabase': 'Not in {database}',
  'schemaSql.dropWarning':
    'Drops {tables} before creating them. Their rows are lost.',
  'schemaSql.replaceWarning': 'Replaces {tables}. Their rows are lost.',
  'schemaSql.moreTables': {
    one: '{count} more table',
    other: '{count} more tables',
  },
  'schemaSql.headerInvalidName':
    'Database name "{name}" is not a valid identifier.',
  'schemaSql.oracleLongNames': 'Oracle 12.2+ for names over 30 bytes: {names}',
  'schemaSql.scriptsCaption':
    'Saved in the document · written as is for every database',
  'schemaSql.beforeTables': 'Before tables',
  'schemaSql.afterTables': 'After tables',
  'schemaSql.afterPlaceholder': '-- GRANT, CREATE VIEW, seed data …',
  'schemaSql.mssqlGoHint':
    'MSSQL gets GO after a script that does not end with GO.',
  'schemaSql.saveFile': 'Save file',
  'schemaSql.saveFileMenu': 'Save file…',
  'schemaSql.optionsPanel': 'Options panel',
  'schemaSql.hideOptions': 'Hide options',
  'schemaSql.showOptions': 'Show options',
} as const;
