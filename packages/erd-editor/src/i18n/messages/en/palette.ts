/**
 * The command palette's own text. A keywords entry holds the words a row is
 * also found by, separated by spaces and shown dimmed beside its name.
 */
export const palette = {
  'palette.tab': 'Tab',
  'palette.noCommandsMatch': 'No commands match',
  'palette.showMatches': {
    one: 'Show {count} match in Find and Replace',
    other: 'Show all {count} matches in Find and Replace',
  },
  'palette.searchTables': 'Search tables for "{keyword}"',
  'palette.searchColumns': 'Search columns for "{keyword}"',
  'palette.searchText': 'Search comments & memos for "{keyword}"',
  'palette.scope.tables': 'Tables',
  'palette.scope.columns': 'Columns',
  'palette.scope.text': 'Comments & memos',
  'palette.scope.help': 'Help',
  'palette.scopeDescription.tables': 'Go to a table by its name',
  'palette.scopeDescription.columns':
    'Go to a column by its name, or by table.column',
  'palette.scopeDescription.text':
    'Search table comments, column comments and memos',
  'palette.scopeDescription.help': 'List the prefixes that narrow the search',
  'palette.keywords.graphql': 'graphql sdl gql schema',
  'palette.keywords.dbml': 'dbml dbdiagram dbdocs schema',
  'palette.keywords.aml': 'aml azimutt markup language schema',
  'palette.keywords.image': 'image png svg vector picture clipboard',
  'palette.keywords.findReplace': 'find replace rename',
  'palette.schemaSqlStatements': 'Schema SQL: Statements',
  'palette.schemaSqlHeader': 'Schema SQL: Header',
  'palette.schemaSqlOptionsPanel': 'Schema SQL: Options panel',
  'palette.codeGeneratorOptionsPanel': 'Code Generator: Options panel',
  'palette.exportSchemaSql': 'Export: Schema SQL',
  'palette.groupSelectedTables': 'Group Selected Tables',
  'palette.keywords.schemaSqlStatements': 'create if not exists drop replace',
  'palette.keywords.schemaSqlHeader': 'use database search_path',
  'palette.keywords.schemaSqlOptionsPanel': 'show hide before after scripts',
  'palette.keywords.codeGeneratorOptionsPanel':
    'show hide database case save file',
  'palette.keywords.exportSchemaSql': 'sql ddl file',
} as const;
