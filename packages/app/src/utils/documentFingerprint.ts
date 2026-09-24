import { mapValues, omit } from 'es-toolkit';

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

/**
 * What a Drive save compares: the document and every setting but the view's.
 * A Drive file is the whole document, so a changed database or column order
 * has to reach it, while a zoom or a scroll alone never makes a save.
 */
export function toDriveFingerprint(value: string) {
  const { doc, collections, settings } = JSON.parse(value);
  return JSON.stringify({
    doc,
    collections: withoutDerived(collections),
    settings: omit(settings, VIEW_SETTINGS),
  });
}
