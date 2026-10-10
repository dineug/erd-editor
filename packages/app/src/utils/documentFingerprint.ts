import { mapValues, omit } from 'es-toolkit';

/**
 * The view bits of LockSettingType, which files save and so never change.
 * Imported from peer.js, they pull its store into the chunk every page preloads.
 */
const VIEWPORT_LOCK = 1;
const CANVAS_TYPE_LOCK = 2;

/**
 * The settings a view writes, by the lock that holds them: where it is scrolled,
 * how far zoomed, which canvas shows. Opening, looking around and switching views
 * changes them unless locked, when the file keeps what the lock holds.
 */
const VIEW_SETTINGS: ReadonlyArray<[number, string[]]> = [
  [VIEWPORT_LOCK, ['originX', 'originY', 'zoomLevel']],
  [CANVAS_TYPE_LOCK, ['canvasType']],
];

/** What a Drive save leaves out of the settings: each view no lock holds. */
const unlockedViewSettings = (lockSettings: number) =>
  VIEW_SETTINGS.flatMap(([bit, fields]) => (lockSettings & bit ? [] : fields));

/**
 * The part of a saved value an edit changes, the Schema SQL scripts in it. The
 * value is the file form a replica hands out, which holds no derived field and
 * no removed entity; the view state it also saves (zoom, scroll, tab) is none.
 */
export function toFingerprint(value: string) {
  const { doc, collections, settings } = JSON.parse(value);
  return JSON.stringify({
    doc,
    collections,
    databaseName: settings.databaseName,
    ddlScripts: settings.ddlScripts,
  });
}

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The document's id lists in id order. Replicas apply concurrent adds in the
 * order each receives them, and no action reorders these lists, so their order
 * is where the replicas came from, not an edit.
 */
const inIdOrder = (doc: Record<string, string[]>) =>
  mapValues(doc, ids => [...ids].sort(byKey));

/**
 * What a Drive save compares: the document and its settings but a view no lock
 * holds. The file is the whole document, so a changed database, column order or
 * locked view reaches it, while a zoom or a scroll never does.
 */
export function toDriveFingerprint(value: string) {
  const { doc, collections, settings } = JSON.parse(value);
  return JSON.stringify({
    doc: inIdOrder(doc),
    collections,
    settings: omit(settings, unlockedViewSettings(settings.lockSettings)),
  });
}
