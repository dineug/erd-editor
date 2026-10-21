import { mapValues, omit, pick } from 'es-toolkit';

import { v2ToV3 } from '@/convert';
import {
  DictionaryKey,
  DictionaryKeyList,
  RuntimeDictionaryFields,
  stringifyDocument,
  toDictionaryRows,
} from '@/dictionaryRows';
import { normalizeSettings } from '@/normalizeSettings';
import { schemaV2Parser } from '@/v2';
import { type ERDEditorSchemaV3, schemaV3Parser } from '@/v3';
import { resetPreLockView } from '@/v3/parser/settings';
import { Doc } from '@/v3/schema/doc';

export function parser(source: string): ERDEditorSchemaV3 {
  const json = JSON.parse(source);
  const version = Reflect.get(json, 'version');

  if (version === '3.0.0') return schemaV3Parser(json);

  const schema = v2ToV3(schemaV2Parser(json));
  resetPreLockView(schema.settings);
  return schema;
}

/**
 * The runtime value: the document as an editor holds it, lossless but for the
 * lww registers, each locked setting at its lock, the locked values left out,
 * the scripts, table groups, dictionaries and new fields only when held.
 */
export function toJson(schemaV3: ERDEditorSchemaV3) {
  const source = pick(schemaV3, [
    '$schema',
    'version',
    'settings',
    'doc',
    'collections',
  ]);

  return stringifyDocument({
    ...source,
    settings: normalizeSettings(source.settings),
    ...withoutEmptyFields(source),
  });
}

const TABLE_DEFAULTS = { logicalName: '', groupId: '', nameDerived: false };
const COLUMN_DEFAULTS = { logicalName: '', domainId: '' };

const DICTIONARY_IDS = {
  wordEntities: 'wordIds',
  termEntities: 'termIds',
  domainEntities: 'domainIds',
} as const satisfies Record<DictionaryKey, keyof Doc>;

/** An entity without each field that holds its default, as a copy. */
function withoutDefaults(
  entity: object,
  defaults: Record<string, unknown>
): object {
  const left = Object.keys(defaults).filter(
    key => Reflect.get(entity, key) === defaults[key]
  );

  return left.length ? omit(entity as Record<string, unknown>, left) : entity;
}

/**
 * The doc and collections with the newer fields written sparsely: the groups
 * and each dictionary with its order while either holds an entry, a removed
 * one too, and the table and column fields while off their defaults.
 */
function withoutEmptyFields({
  doc,
  collections,
}: Pick<ERDEditorSchemaV3, 'doc' | 'collections'>) {
  const hasGroups =
    (doc.tableGroupIds?.length ?? 0) !== 0 ||
    Object.keys(collections.tableGroupEntities ?? {}).length !== 0;
  const written: {
    doc: Record<string, unknown>;
    collections: Record<string, unknown>;
  } = {
    doc: hasGroups ? { ...doc } : omit(doc, ['tableGroupIds']),
    collections: {
      ...(hasGroups ? collections : omit(collections, ['tableGroupEntities'])),
      tableEntities: mapValues(collections.tableEntities ?? {}, table =>
        withoutDefaults(table, TABLE_DEFAULTS)
      ),
    },
  };

  if (collections.tableColumnEntities) {
    written.collections.tableColumnEntities = mapValues(
      collections.tableColumnEntities,
      column => withoutDefaults(column, COLUMN_DEFAULTS)
    );
  }

  for (const key of DictionaryKeyList) {
    const idsKey = DICTIONARY_IDS[key];
    const ids = doc[idsKey] ?? [];
    const entities = Object.values(collections[key] ?? {});

    if (ids.length === 0 && entities.length === 0) {
      delete written.doc[idsKey];
      delete written.collections[key];
    } else {
      written.doc[idsKey] = ids;
      written.collections[key] = toDictionaryRows(
        key,
        entities,
        RuntimeDictionaryFields[key]
      );
    }
  }

  return written;
}
