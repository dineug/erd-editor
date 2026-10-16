import { observable } from '@dineug/r-html';

/**
 * The relationship a jump lights in each editor, one observable flag per
 * editor.id and relationship id. It stays out of the store, so no file, history
 * entry or peer ever holds it, and a read of a key never lit adds none.
 */
const lit = observable<Record<string, true>>({});
const litOf = new Map<string, string>();

const keyOf = (editorId: string, relationshipId: string) =>
  `${editorId}\u0000${relationshipId}`;

/** Lights one relationship in the editor, and puts out the one it lit before. */
export function setRelationshipHighlight(
  editorId: string,
  relationshipId: string
) {
  clearRelationshipHighlight(editorId);
  litOf.set(editorId, relationshipId);
  lit[keyOf(editorId, relationshipId)] = true;
}

/** Puts out whatever relationship the editor has lit. */
export function clearRelationshipHighlight(editorId: string) {
  const relationshipId = litOf.get(editorId);
  if (relationshipId === undefined) return;

  litOf.delete(editorId);
  Reflect.deleteProperty(lit, keyOf(editorId, relationshipId));
}

/** Whether a jump has lit the relationship, read by its connector as it reads a hover. */
export function isRelationshipHighlighted(
  editorId: string,
  relationshipId: string
): boolean {
  return lit[keyOf(editorId, relationshipId)] === true;
}

/** Forgets an editor that went, whose id nothing reads again. */
export function dropRelationshipHighlight(editorId: string) {
  clearRelationshipHighlight(editorId);
}

/**
 * Test-only probe: the flags the reactive record holds and the editors it
 * remembers, which a read of an editor never lit must not grow. Nothing
 * shipping calls it.
 */
export function countRelationshipHighlights() {
  return { flags: Object.keys(lit).length, editors: litOf.size };
}
