import { RelationshipType } from '@/constants/schema';

/**
 * The Map Columns dialog, the relationship menu item that opens it and the
 * buttons beside a table a relationship is drawn to, as whole sentences whose
 * names and types are written into their placeholders.
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

/**
 * The words the dialog shares with the rest of the editor, under the keys the
 * editor's shared dictionary gives them, so they leave this file once it has one.
 */
export const mapColumnsCommon = {
  'common.primaryKey': 'Primary Key',
  'common.cancel': 'Cancel',
  'common.unnamed': 'unnamed',
  'common.relationshipType.zeroOne': 'Zero One',
  'common.relationshipType.zeroN': 'Zero N',
  'common.relationshipType.oneOnly': 'One Only',
  'common.relationshipType.oneN': 'One N',
} as const;

const messages = { ...mapColumns, ...mapColumnsCommon };

type Messages = typeof messages;

export type MapColumnsTextKey = keyof Messages;

type PlaceholdersOf<S extends string> =
  S extends `${string}{${infer Name}}${infer Rest}`
    ? Name | PlaceholdersOf<Rest>
    : never;

/** The keys whose sentence takes no value. */
export type PlainMapColumnsTextKey = {
  [K in MapColumnsTextKey]: [PlaceholdersOf<Messages[K]>] extends [never]
    ? K
    : never;
}[MapColumnsTextKey];

type ArgsOf<K extends MapColumnsTextKey> = [
  PlaceholdersOf<Messages[K]>,
] extends [never]
  ? []
  : [params: { readonly [P in PlaceholdersOf<Messages[K]>]: string | number }];

const PLACEHOLDER = /\{(\w+)\}/g;

/** The sentence under the key, each placeholder given its value. */
export function mapColumnsText<K extends MapColumnsTextKey>(
  key: K,
  ...[params]: ArgsOf<K>
): string {
  const template: string = messages[key];
  if (!params) return template;

  const values = params as Readonly<Record<string, string | number>>;
  return template.replace(PLACEHOLDER, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder
  );
}

/** A table's or column's name as these sentences write it, unnamed where it is blank. */
export const nameOf = (entity: { name: string }) =>
  entity.name.trim() ? entity.name : mapColumnsText('common.unnamed');

const relationshipTypeKeys: Readonly<Record<number, PlainMapColumnsTextKey>> = {
  [RelationshipType.ZeroOne]: 'common.relationshipType.zeroOne',
  [RelationshipType.ZeroN]: 'common.relationshipType.zeroN',
  [RelationshipType.OneOnly]: 'common.relationshipType.oneOnly',
  [RelationshipType.OneN]: 'common.relationshipType.oneN',
};

/** The notation's name, as the relationship menu lists it. */
export const relationshipTypeText = (relationshipType: number) => {
  const key = relationshipTypeKeys[relationshipType];
  return key ? mapColumnsText(key) : '';
};
