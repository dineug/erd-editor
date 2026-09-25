import { mapValues, omit, pickBy } from 'es-toolkit';

/** The foreign key bit of ui.keys, kept in step with the relationships. */
const FOREIGN_KEY = 2;

/**
 * The settings a view writes: where it is scrolled, how far zoomed, which
 * canvas shows. Opening, looking around and switching views changes them.
 */
const VIEW_SETTINGS = [
  'scrollTop',
  'scrollLeft',
  'originX',
  'originY',
  'zoomLevel',
  'canvasType',
] as const;

const withoutAnchor = (end: Record<string, unknown>) =>
  omit(end, ['x', 'y', 'direction']);

/**
 * Collections less what the engine derives from the rest of them and rewrites
 * after a load without an action: text widths, measured with this machine's
 * fonts, connector anchors, and flags read off the columns and relationships.
 */
function withoutDerived(collections: any) {
  return {
    ...collections,
    tableEntities: mapValues(collections.tableEntities, (table: any) => ({
      ...table,
      ui: omit(table.ui, ['widthName', 'widthComment']),
    })),
    tableColumnEntities: mapValues(
      collections.tableColumnEntities,
      (column: any) => ({
        ...column,
        ui: {
          ...omit(column.ui, [
            'widthName',
            'widthComment',
            'widthDataType',
            'widthDefault',
          ]),
          keys: column.ui.keys & ~FOREIGN_KEY,
        },
      })
    ),
    relationshipEntities: mapValues(
      collections.relationshipEntities,
      (relationship: any) => ({
        ...omit(relationship, ['identification', 'startRelationshipType']),
        start: withoutAnchor(relationship.start),
        end: withoutAnchor(relationship.end),
      })
    ),
  };
}

/**
 * The part of a saved value an edit changes. The engine also saves view state
 * (zoom, scroll, canvas type) as a change, and none of that is an edit. The
 * value is always the replica's own, so every collection and ui is present.
 */
export function toFingerprint(value: string) {
  const { doc, collections, settings } = JSON.parse(value);
  return JSON.stringify({
    doc,
    collections: withoutDerived(collections),
    databaseName: settings.databaseName,
  });
}

/** Collections less each entity's meta, which every replica stamps with its own clock. */
const withoutMeta = (collections: any) =>
  mapValues(collections, (entities: any) =>
    mapValues(entities, (entity: any) => omit(entity, ['meta']))
  );

/**
 * The document less what no longer hangs off it: removed tables and memos, and
 * what belongs to a removed table. The element's collector drops those three
 * days on, a macrotask or more after a load, and a removal shows in doc anyway.
 */
function reachable(doc: any, collections: Record<string, Record<string, any>>) {
  const tableIds = new Set<string>(doc.tableIds);
  const memoIds = new Set<string>(doc.memoIds);
  const relationshipIds = doc.relationshipIds.filter((id: string) => {
    const relationship = collections.relationshipEntities[id];
    return (
      tableIds.has(relationship?.start.tableId) &&
      tableIds.has(relationship?.end.tableId)
    );
  });
  const indexIds = doc.indexIds.filter((id: string) =>
    tableIds.has(collections.indexEntities[id]?.tableId)
  );
  const keptRelationships = new Set<string>(relationshipIds);
  const keptIndexes = new Set<string>(indexIds);
  return {
    doc: { ...doc, relationshipIds, indexIds },
    collections: {
      ...collections,
      tableEntities: pickBy(collections.tableEntities, (_table, id) =>
        tableIds.has(id)
      ),
      tableColumnEntities: pickBy(collections.tableColumnEntities, column =>
        tableIds.has(column.tableId)
      ),
      relationshipEntities: pickBy(
        collections.relationshipEntities,
        (_relationship, id) => keptRelationships.has(id)
      ),
      indexEntities: pickBy(collections.indexEntities, (_index, id) =>
        keptIndexes.has(id)
      ),
      indexColumnEntities: pickBy(collections.indexColumnEntities, column =>
        keptIndexes.has(column.indexId)
      ),
      memoEntities: pickBy(collections.memoEntities, (_memo, id) =>
        memoIds.has(id)
      ),
    },
  };
}

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The document's id lists and every collection in id order. Replicas apply
 * concurrent adds in the order each receives them, and no action reorders
 * these lists, so their order is where the replicas came from, not an edit.
 */
function inIdOrder(doc: any, collections: Record<string, Record<string, any>>) {
  return {
    doc: {
      ...doc,
      tableIds: [...doc.tableIds].sort(byKey),
      relationshipIds: [...doc.relationshipIds].sort(byKey),
      indexIds: [...doc.indexIds].sort(byKey),
      memoIds: [...doc.memoIds].sort(byKey),
    },
    collections: mapValues(collections, entities =>
      Object.fromEntries(
        Object.entries(entities).sort(([a], [b]) => byKey(a, b))
      )
    ),
  };
}

/**
 * What a Drive save compares: the document and every setting but the view's.
 * A Drive file is the whole document, so a changed database or column order
 * has to reach it, while a zoom, a scroll or a collected tombstone never does.
 */
export function toDriveFingerprint(value: string) {
  const json = JSON.parse(value);
  const live = reachable(json.doc, json.collections);
  const { doc, collections } = inIdOrder(live.doc, live.collections);
  return JSON.stringify({
    doc,
    collections: withoutDerived(withoutMeta(collections)),
    settings: omit(json.settings, VIEW_SETTINGS),
  });
}
