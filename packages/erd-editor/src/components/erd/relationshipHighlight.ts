import { observable } from '@dineug/r-html';

/**
 * The relationship a jump lights in each editor, keyed by editor.id, each a
 * record of its own so a connector tracks only its own key. It stays out of the
 * store, so no file, history entry or peer ever holds it.
 */
const records = new Map<string, Record<string, true>>();

function recordOf(editorId: string): Record<string, true> {
  let record = records.get(editorId);

  if (!record) {
    record = observable<Record<string, true>>({});
    records.set(editorId, record);
  }

  return record;
}

/** Lights one relationship in the editor, and puts out the one it lit before. */
export function setRelationshipHighlight(
  editorId: string,
  relationshipId: string
) {
  const record = recordOf(editorId);

  Object.keys(record).forEach(id => {
    if (id !== relationshipId) Reflect.deleteProperty(record, id);
  });
  record[relationshipId] = true;
}

/** Puts out whatever relationship the editor has lit. */
export function clearRelationshipHighlight(editorId: string) {
  const record = records.get(editorId);
  if (!record) return;

  Object.keys(record).forEach(id => Reflect.deleteProperty(record, id));
}

/** Whether a jump has lit the relationship, read by its connector as it reads a hover. */
export function isRelationshipHighlighted(
  editorId: string,
  relationshipId: string
): boolean {
  return recordOf(editorId)[relationshipId] === true;
}

/** Forgets an editor that went, whose id nothing reads again. */
export function dropRelationshipHighlight(editorId: string) {
  clearRelationshipHighlight(editorId);
  records.delete(editorId);
}
