import { isNumber, isPlainObject, isString } from 'es-toolkit';

import { fromDictionaryRows } from '@/dictionaryRows';
import { entryId } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { settleOrderKeys } from '@/orderKey';
import { createAndMergeDoc } from '@/v3/parser/doc';
import { createAndMergeDomainEntities } from '@/v3/parser/domain.entity';
import { createAndMergeIndexEntities } from '@/v3/parser/index.entity';
import { createAndMergeIndexColumnEntities } from '@/v3/parser/indexColumn.entity';
import { createAndMergeMemoEntities } from '@/v3/parser/memo.entity';
import { createAndMergeRelationshipEntities } from '@/v3/parser/relationship.entity';
import { createAndMergeSettings } from '@/v3/parser/settings';
import { createAndMergeTableEntities } from '@/v3/parser/table.entity';
import { createAndMergeTableColumnEntities } from '@/v3/parser/tableColumn.entity';
import { createAndMergeTableGroupEntities } from '@/v3/parser/tableGroup.entity';
import { createAndMergeTermEntities } from '@/v3/parser/term.entity';
import { createAndMergeWordEntities } from '@/v3/parser/word.entity';
import { ERDEditorSchemaV3 } from '@/v3/schema';
import { Domain } from '@/v3/schema/domain.entity';

export function parser(source: any): ERDEditorSchemaV3 {
  const json: DeepPartial<ERDEditorSchemaV3> = source;

  const settings = createAndMergeSettings(json.settings);
  const doc = createAndMergeDoc(json.doc);

  const tableEntities = createAndMergeTableEntities(
    json.collections?.tableEntities
  );
  const tableColumnEntities = createAndMergeTableColumnEntities(
    json.collections?.tableColumnEntities
  );
  const relationshipEntities = createAndMergeRelationshipEntities(
    json.collections?.relationshipEntities
  );
  const indexEntities = createAndMergeIndexEntities(
    json.collections?.indexEntities
  );
  const indexColumnEntities = createAndMergeIndexColumnEntities(
    json.collections?.indexColumnEntities
  );
  const memoEntities = createAndMergeMemoEntities(
    json.collections?.memoEntities
  );
  const tableGroupEntities = createAndMergeTableGroupEntities(
    json.collections?.tableGroupEntities
  );

  for (const [list, collection] of HELD_LISTS) {
    if (!Array.isArray(json.doc?.[list])) {
      doc[list] = heldIds(json.collections?.[collection]);
    }
  }

  const words = fromDictionaryRows(json.collections?.wordEntities);
  const terms = fromDictionaryRows(json.collections?.termEntities);
  const domains = fromDictionaryRows(json.collections?.domainEntities);
  const wordEntities = createAndMergeWordEntities(words);
  const termEntities = createAndMergeTermEntities(terms);
  const domainEntities = createAndMergeDomainEntities(domains);

  // A file holds a dictionary's membership and order in its rows alone; the
  // runtime value names the membership, removed rows left out, and keys the rows.
  if (!Array.isArray(json.doc?.wordIds)) doc.wordIds = rowIds(words);
  if (!Array.isArray(json.doc?.termIds)) doc.termIds = rowIds(terms);
  if (!Array.isArray(json.doc?.domainIds)) doc.domainIds = rowIds(domains);
  settleOrderKeys(wordEntities, doc.wordIds);
  settleOrderKeys(termEntities, doc.termIds);
  settleOrderKeys(domainEntities, doc.domainIds);

  clearUnknownDomains(domainEntities, tableColumnEntities, termEntities);

  stackInDocOrder(
    tableEntities,
    doc.tableIds,
    json.collections?.tableEntities,
    2
  );
  // Tables and memos share one stack, so unsaved memos count on past every
  // listed table and stand over them, as every memo did before they shared it.
  stackInDocOrder(
    memoEntities,
    doc.memoIds,
    json.collections?.memoEntities,
    Math.max(1, ...doc.tableIds.map(id => tableEntities[id]?.ui.zIndex ?? 0)) +
      1
  );
  stackInDocOrder(
    tableGroupEntities,
    doc.tableGroupIds,
    json.collections?.tableGroupEntities,
    1
  );

  return {
    $schema:
      'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json',
    version: '3.0.0',
    settings,
    doc,
    collections: {
      tableEntities,
      tableColumnEntities,
      relationshipEntities,
      indexEntities,
      indexColumnEntities,
      memoEntities,
      tableGroupEntities,
      wordEntities,
      termEntities,
      domainEntities,
    },
  };
}

/**
 * The doc lists a file may leave out, each with the collection whose entries
 * it then lists, since a file holds the live entries alone.
 */
const HELD_LISTS = [
  ['tableIds', 'tableEntities'],
  ['relationshipIds', 'relationshipEntities'],
  ['indexIds', 'indexEntities'],
  ['memoIds', 'memoEntities'],
  ['tableGroupIds', 'tableGroupEntities'],
] as const;

/** The ids a collection's entries go by, each once, in the order held. */
function heldIds(source: unknown): string[] {
  if (!isPlainObject(source)) return [];

  const ids = Object.entries(source)
    .filter(([, value]) => isPlainObject(value))
    .map(([key, value]) => entryId(key, value))
    .filter(id => id !== '');
  return [...new Set(ids)];
}

/** The ids a dictionary's entries hold, each once, in the order held. */
const rowIds = (values: ReadonlyArray<Record<string, unknown>>): string[] => [
  ...new Set(
    values
      .map(value => value.id)
      .filter((id): id is string => isString(id) && id !== '')
  ),
];

/**
 * Clears each domainId naming no domain the collection holds, so no reader
 * meets a link to nothing; a removed domain still counts, since an undo can
 * bring it back, and the storage form leaves a link to one out.
 */
function clearUnknownDomains(
  domains: Record<string, Domain>,
  ...linked: Array<Record<string, { domainId: string }>>
) {
  const known = new Set(Object.keys(domains));

  for (const entities of linked) {
    for (const entity of Object.values(entities)) {
      if (entity.domainId && !known.has(entity.domainId)) entity.domainId = '';
    }
  }
}

/**
 * Gives each listed entity the source left without a z-index its place in the
 * doc order, counted up from the base the caller gives, since the storage form
 * writes none; one that carries a z-index keeps it, as does one not listed.
 */
function stackInDocOrder(
  entities: Record<string, { ui: { zIndex: number } }>,
  ids: ReadonlyArray<string>,
  source: unknown,
  base: number
) {
  const stacked = idsWithZIndex(source);

  ids.forEach((id, index) => {
    const entity = entities[id];
    if (!entity || stacked.has(id)) return;

    entity.ui.zIndex = base + index;
    stacked.add(id);
  });
}

/**
 * The ids whose raw entity carries a numeric z-index, the last entry going by
 * an id deciding, as it does in the entity parsers.
 */
function idsWithZIndex(source: unknown): Set<string> {
  const ids = new Set<string>();
  if (!isPlainObject(source)) return ids;

  for (const [key, value] of Object.entries(source)) {
    if (!isPlainObject(value)) continue;

    const id = entryId(key, value);
    const ui = value.ui;
    if (isPlainObject(ui) && isNumber(ui.zIndex)) {
      ids.add(id);
    } else {
      ids.delete(id);
    }
  }

  return ids;
}

/**
 * A document created from nothing, every lockable setting locked at its
 * default, so looking around a new diagram never changes its file.
 */
export function createSchema(): ERDEditorSchemaV3 {
  return parser({});
}
