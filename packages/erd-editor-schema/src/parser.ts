import { mapValues, omit, pick } from 'es-toolkit';

import { v2ToV3 } from '@/convert';
import { normalizeSettings } from '@/normalizeSettings';
import { schemaV2Parser } from '@/v2';
import { type ERDEditorSchemaV3, schemaV3Parser } from '@/v3';
import { resetPreLockView } from '@/v3/parser/settings';

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
 * the scripts and table groups only when held.
 */
export function toJson(schemaV3: ERDEditorSchemaV3) {
  const source = pick(schemaV3, [
    '$schema',
    'version',
    'settings',
    'doc',
    'collections',
  ]);

  return JSON.stringify(
    {
      ...source,
      settings: normalizeSettings(source.settings),
      ...withoutEmptyTableGroups(source),
    },
    null,
    2
  );
}

/**
 * The doc and collections with the table group fields written sparsely: the
 * groups and their order while either holds an entry, a removed group's too,
 * a groupId while not empty, so a document that never had one keeps its bytes.
 */
function withoutEmptyTableGroups({
  doc,
  collections,
}: Pick<ERDEditorSchemaV3, 'doc' | 'collections'>) {
  const hasGroups =
    (doc.tableGroupIds?.length ?? 0) !== 0 ||
    Object.keys(collections.tableGroupEntities ?? {}).length !== 0;
  const tableEntities = mapValues(collections.tableEntities ?? {}, table =>
    table.groupId ? table : omit(table, ['groupId'])
  );

  return hasGroups
    ? { doc, collections: { ...collections, tableEntities } }
    : {
        doc: omit(doc, ['tableGroupIds']),
        collections: {
          ...omit(collections, ['tableGroupEntities']),
          tableEntities,
        },
      };
}
