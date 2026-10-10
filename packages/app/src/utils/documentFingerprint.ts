import { mapValues, omit, pickBy } from 'es-toolkit';

/** The foreign key bit of ui.keys, kept in step with the relationships. */
const FOREIGN_KEY = 2;

/**
 * The view bits of LockSettingType, which files save and so never change.
 * Imported from peer.js, they pull its store into the chunk every page preloads.
 */
const VIEWPORT_LOCK = 1;
const CANVAS_TYPE_LOCK = 2;

/** The scroll a release before the origin saved, which no editor moves now. */
const LEGACY_SCROLL = ['scrollTop', 'scrollLeft'];

/**
 * The settings a view writes, by the lock that holds them: where it is scrolled,
 * how far zoomed, which canvas shows. Opening, looking around and switching views
 * changes them unless locked, when the file keeps what the lock holds.
 */
const VIEW_SETTINGS: ReadonlyArray<[number, string[]]> = [
  [VIEWPORT_LOCK, ['originX', 'originY', 'zoomLevel']],
  [CANVAS_TYPE_LOCK, ['canvasType']],
];

/** What a Drive save leaves out of the settings: the legacy scroll, each view no lock holds. */
const unlockedViewSettings = (lockSettings: number) => [
  ...LEGACY_SCROLL,
  ...VIEW_SETTINGS.flatMap(([bit, fields]) =>
    lockSettings & bit ? [] : fields
  ),
];

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
 * The part of a saved value an edit changes, the Schema SQL scripts in it. The
 * engine also saves view state (zoom, scroll, canvas type) as a change, and
 * none of that is an edit. The value is always the replica's own.
 */
export function toFingerprint(value: string) {
  const { doc, collections, settings } = JSON.parse(value);
  return JSON.stringify({
    doc,
    collections: withoutDerived(collections),
    databaseName: settings.databaseName,
    ddlScripts: settings.ddlScripts,
  });
}

/**
 * The table groups doc lists, and with none listed neither group field: a file
 * writes both while a removed group's tombstone is left.
 */
function listedTableGroups(
  doc: any,
  collections: Record<string, Record<string, any>>
) {
  const tableGroupIds = new Set<string>(doc.tableGroupIds);
  if (!tableGroupIds.size) {
    return {
      doc: omit(doc, ['tableGroupIds']),
      collections: omit(collections, ['tableGroupEntities']),
    };
  }
  return {
    doc,
    collections: {
      ...collections,
      tableGroupEntities: pickBy(collections.tableGroupEntities, (_group, id) =>
        tableGroupIds.has(id)
      ),
    },
  };
}

/**
 * The document less what no longer hangs off it: removed tables, memos and table
 * groups, and what belongs to a removed table, which a replica keeps as their
 * tombstones; a removal shows in doc anyway.
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
  return listedTableGroups(
    { ...doc, relationshipIds, indexIds },
    {
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
    }
  );
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
      ...(doc.tableGroupIds && {
        tableGroupIds: [...doc.tableGroupIds].sort(byKey),
      }),
    },
    collections: mapValues(collections, entities =>
      Object.fromEntries(
        Object.entries(entities).sort(([a], [b]) => byKey(a, b))
      )
    ),
  };
}

/**
 * What a Drive save compares: the document and its settings but a view no lock
 * holds. The file is the whole document, so a changed database, column order or
 * locked view reaches it, while a zoom, a scroll or a tombstone never does.
 */
export function toDriveFingerprint(value: string) {
  const json = JSON.parse(value);
  const live = reachable(json.doc, json.collections);
  const { doc, collections } = inIdOrder(live.doc, live.collections);
  return JSON.stringify({
    doc,
    collections: withoutDerived(collections),
    settings: omit(
      json.settings,
      unlockedViewSettings(json.settings.lockSettings)
    ),
  });
}
