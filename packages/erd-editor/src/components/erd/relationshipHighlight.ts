import { observable } from '@dineug/r-html';

/**
 * The relationships a host lights in each editor, one observable flag per
 * editor.id and relationship id. It stays out of the store, so no file, history
 * entry or peer ever holds it, and a read of a key never lit adds none.
 */
const lit = observable<Record<string, true>>({});
const litOf = new Map<string, readonly string[]>();

const keyOf = (editorId: string, relationshipId: string) =>
  `${editorId}\u0000${relationshipId}`;

/**
 * Lights the relationships given in the editor and puts out the ones it lit
 * before, touching only the flags that change; an empty list puts all out.
 */
export function setRelationshipHighlights(
  editorId: string,
  relationshipIds: readonly string[]
) {
  const next = new Set(relationshipIds);

  for (const id of litOf.get(editorId) ?? []) {
    if (!next.has(id)) Reflect.deleteProperty(lit, keyOf(editorId, id));
  }

  if (!next.size) {
    litOf.delete(editorId);
    return;
  }

  litOf.set(editorId, [...next]);
  for (const id of next) {
    const key = keyOf(editorId, id);
    if (!lit[key]) lit[key] = true;
  }
}

/** Lights one relationship in the editor, as a jump does, and puts out what it lit before. */
export function setRelationshipHighlight(
  editorId: string,
  relationshipId: string
) {
  setRelationshipHighlights(editorId, [relationshipId]);
}

/** Puts out whatever relationships the editor has lit. */
export function clearRelationshipHighlight(editorId: string) {
  setRelationshipHighlights(editorId, []);
}

/** Whether the host has lit the relationship, read by its connector as it reads a hover. */
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
