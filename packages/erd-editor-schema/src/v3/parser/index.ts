import { isNumber, isPlainObject, isString } from 'es-toolkit';

import { DeepPartial } from '@/internal-types';
import { createAndMergeDoc } from '@/v3/parser/doc';
import { createAndMergeIndexEntities } from '@/v3/parser/index.entity';
import { createAndMergeIndexColumnEntities } from '@/v3/parser/indexColumn.entity';
import { createAndMergeMemoEntities } from '@/v3/parser/memo.entity';
import { createAndMergeRelationshipEntities } from '@/v3/parser/relationship.entity';
import { createAndMergeSettings } from '@/v3/parser/settings';
import { createAndMergeTableEntities } from '@/v3/parser/table.entity';
import { createAndMergeTableColumnEntities } from '@/v3/parser/tableColumn.entity';
import { createAndMergeTableGroupEntities } from '@/v3/parser/tableGroup.entity';
import { ERDEditorSchemaV3 } from '@/v3/schema';

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

  stackInDocOrder(
    tableEntities,
    doc.tableIds,
    json.collections?.tableEntities,
    2
  );
  stackInDocOrder(memoEntities, doc.memoIds, json.collections?.memoEntities, 2);
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
    },
  };
}

/**
 * Gives each listed entity the source left without a z-index its place in the
 * doc order, counted up from the factory default, since the storage form
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
 * The ids whose raw entity carries a numeric z-index, the last entry with an
 * id deciding, as it does in the entity parsers.
 */
function idsWithZIndex(source: unknown): Set<string> {
  const ids = new Set<string>();
  if (!isPlainObject(source)) return ids;

  for (const value of Object.values(source)) {
    if (!isPlainObject(value) || !isString(value.id)) continue;

    const ui = value.ui;
    if (isPlainObject(ui) && isNumber(ui.zIndex)) {
      ids.add(value.id);
    } else {
      ids.delete(value.id);
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
