import { isPlainObject } from 'es-toolkit';

import { Domain } from '@/v3/schema/domain.entity';
import { Term } from '@/v3/schema/term.entity';
import { Word } from '@/v3/schema/word.entity';

/**
 * The fields each dictionary collection names in its header, id first, in the
 * order its rows hold the values.
 */
export const DictionaryFields = {
  wordEntities: [
    'id',
    'name',
    'abbreviation',
    'englishName',
    'description',
    'synonyms',
    'forbiddenWords',
  ],
  termEntities: [
    'id',
    'name',
    'physicalName',
    'domainId',
    'description',
    'synonyms',
  ],
  domainEntities: ['id', 'name', 'category', 'dataType', 'description'],
} as const satisfies {
  wordEntities: ReadonlyArray<keyof Word>;
  termEntities: ReadonlyArray<keyof Term>;
  domainEntities: ReadonlyArray<keyof Domain>;
};

export type DictionaryKey = keyof typeof DictionaryFields;

function withOrderKey<const T extends ReadonlyArray<string>>(
  fields: T
): ReadonlyArray<string> {
  return [...fields.slice(0, 2), 'order', ...fields.slice(2)];
}

/**
 * The fields the runtime value names: a file's, with each row's order key after
 * the name, where no trailing empty value pushes it, since a file leaves the
 * order to its rows.
 */
export const RuntimeDictionaryFields = {
  wordEntities: withOrderKey(DictionaryFields.wordEntities),
  termEntities: withOrderKey(DictionaryFields.termEntities),
  domainEntities: withOrderKey(DictionaryFields.domainEntities),
} as const satisfies Record<DictionaryKey, ReadonlyArray<string>>;

export const DictionaryKeyList = Object.keys(
  DictionaryFields
) as ReadonlyArray<DictionaryKey>;

/** A dictionary collection as a document writes it: one header, then rows. */
export type DictionaryRows = {
  fields: string[];
  rows: unknown[][];
};

// Every row keeps its id and its name, whatever they hold.
const KEPT_VALUES = 2;

const isEmptyValue = (value: unknown) =>
  value === '' || (Array.isArray(value) && value.length === 0);

/**
 * The header and rows of the given entities in the order given, a file's fields
 * unless others are given: each row holds the values in header order, its
 * trailing empty ones past the name left out, so a field added costs nothing.
 */
export function toDictionaryRows(
  key: DictionaryKey,
  entities: ReadonlyArray<object>,
  fields: ReadonlyArray<string> = DictionaryFields[key]
): DictionaryRows {
  return {
    fields: [...fields],
    rows: entities.map(entity => {
      const row = fields.map(field => Reflect.get(entity, field));
      let end = row.length;
      while (end > KEPT_VALUES && isEmptyValue(row[end - 1])) end--;
      return row.slice(0, end);
    }),
  };
}

/**
 * The entities a dictionary collection holds, in its order: each row read by
 * the field names of the header, without the values it lacks, or the values of
 * an id map, as an editor holds the collection.
 */
export function fromDictionaryRows(
  json: unknown
): Array<Record<string, unknown>> {
  if (!isPlainObject(json)) return [];

  const { fields, rows } = json;
  if (Array.isArray(fields) && Array.isArray(rows)) {
    return rows
      .filter(Array.isArray)
      .map(row =>
        Object.fromEntries(
          fields.slice(0, row.length).map((field, index) => [field, row[index]])
        )
      );
  }

  return Object.values(json).filter(isPlainObject);
}

const ROWS_PLACEHOLDER = /\n {6}"rows": \[\]/g;

const isDictionaryRows = (value: unknown): value is DictionaryRows =>
  isPlainObject(value) && Array.isArray(value.rows);

/**
 * A document as JSON text indented by two spaces, each dictionary row on a line
 * of its own: the rows replace the empty array JSON.stringify writes for each
 * collection, in the order written, so every other byte is its own.
 */
export function stringifyDocument<T extends { collections: object }>(
  document: T
): string {
  const blocks: unknown[][][] = [];
  const collections: Record<string, unknown> = { ...document.collections };

  for (const [key, collection] of Object.entries(collections)) {
    if (
      !DictionaryKeyList.includes(key as DictionaryKey) ||
      !isDictionaryRows(collection)
    ) {
      continue;
    }

    blocks.push(collection.rows);
    collections[key] = { ...collection, rows: [] };
  }

  let next = 0;
  return JSON.stringify({ ...document, collections }, null, 2).replace(
    ROWS_PLACEHOLDER,
    placeholder => {
      const rows = blocks[next++] ?? [];
      if (rows.length === 0) return placeholder;

      const lines = rows.map(row => `        ${JSON.stringify(row)}`);
      return `\n      "rows": [\n${lines.join(',\n')}\n      ]`;
    }
  );
}
