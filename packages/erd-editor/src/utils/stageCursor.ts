/** The closed hand a pan shows for as long as it holds the canvas. */
export const CURSOR_GRABBING = 'grabbing';

/** The last cursor a hover asked for under a held gesture, noted and not shown. */
type StageCursorHold = { requested: string };

const stageCursorHolds = new WeakMap<HTMLElement, StageCursorHold>();

/**
 * Points a stage container at a cursor. A konva node carries none of its own,
 * so the container wears the one its hover asks for; under a hold the cursor
 * is only noted, for the release to write back.
 *
 * @example
 * setStageCursor(stage.container(), 'pointer');
 */
export function setStageCursor(container: HTMLElement, cursor: string): void {
  const hold = stageCursorHolds.get(container);
  if (hold) hold.requested = cursor;
  else container.style.cursor = cursor;
}

/**
 * Keeps a stage container on a cursor for a gesture, whatever the pointer runs
 * over, and hands back the release that shows what the last hover asked for.
 *
 * @example
 * drag$.subscribe(handleMove).add(holdStageCursor(container, CURSOR_GRABBING));
 */
export function holdStageCursor(
  container: HTMLElement,
  cursor: string
): () => void {
  // A press inside another one starts from what that one noted, because the
  // container shows only the cursor the earlier press is holding it on.
  const hold: StageCursorHold = {
    requested:
      stageCursorHolds.get(container)?.requested ?? container.style.cursor,
  };
  stageCursorHolds.set(container, hold);
  container.style.cursor = cursor;

  return () => {
    if (stageCursorHolds.get(container) !== hold) return;
    stageCursorHolds.delete(container);
    container.style.cursor = hold.requested;
  };
}
