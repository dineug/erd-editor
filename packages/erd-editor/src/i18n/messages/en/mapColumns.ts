/**
 * Map Columns: its dialog, the relationship menu row that opens it and the two
 * buttons beside the table a relationship is drawn to. Table and column names
 * and data types enter as placeholders and stay as written.
 */
export const mapColumns = {
  'mapColumns.title': 'Map Columns',
  'mapColumns.subtitle': '{parent} → {child} · {relationshipType}',
  'mapColumns.mapToExisting': 'Map to existing columns',
  'mapColumns.createNew': 'Create new columns',
  'mapColumns.noPrimaryKeyToCopy': '{table} has no primary key to copy',
  'mapColumns.references': 'References',
  'mapColumns.unique': 'Unique: {column}',
  'mapColumns.currentColumns': 'Current columns (not a key)',
  'mapColumns.referencedColumn': 'Referenced column',
  'mapColumns.foreignKeyColumn': 'Foreign key column',
  'mapColumns.pickColumn': 'Pick a column',
  'mapColumns.newColumn': 'New column: {name}',
  'mapColumns.columnOption': '{name} ({dataType})',
  'mapColumns.columnOptionInUse': '{name} ({dataType}) · in use',
  'mapColumns.removed': '(removed)',
  'mapColumns.invalid': '(invalid)',
  'mapColumns.becomesType': '{column} becomes {dataType}',
  'mapColumns.typesDiffer': 'Types differ: {parentType} and {childType}',
  'mapColumns.selfOnly':
    'At least one column must reference a different column',
  'mapColumns.duplicate':
    'These columns are already linked by another relationship',
  'mapColumns.noKey': '{table} has no key to reference',
  'mapColumns.notAKey': 'The referenced columns are not a key of {table}',
  'mapColumns.fixMapping': 'Pick a key in References to fix this mapping',
  'mapColumns.addKeyToFix':
    'Add a primary key or unique column to {table} to fix this mapping',
  'mapColumns.changedRemotely':
    'This relationship changed while the dialog was open',
  'mapColumns.map': 'Map',
  'mapColumns.save': 'Save',
  'mapColumns.closedTableRemoved': 'Map Columns closed: {table} was removed',
  'mapColumns.closedRelationshipRemoved':
    'Map Columns closed: the relationship was removed',
  'mapColumns.failed': "Couldn't map columns: the diagram changed",
} as const;
