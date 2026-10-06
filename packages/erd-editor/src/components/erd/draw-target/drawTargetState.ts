import { observable } from '@dineug/r-html';

import type { RootState } from '@/engine/state';
import type { Point } from '@/internal-types';
import { sceneKeyOf } from '@/konva/scene/viewFreeze';

/**
 * What the buttons beside the table a relationship is drawn to follow, in
 * screen pixels from the top left of the editor's canvas root.
 */
export type DrawTarget = {
  /** Where the pointer last stood over the canvas, or null once it left. */
  pointer: Point | null;
  /** The press that picked the table the draw starts from. */
  pressPoint: Point | null;
  /** Whether the pointer has travelled far enough from that press for the start table to offer the buttons too. */
  selfArmed: boolean;
  /** The table the pointer points the draw at. */
  targetId: string | null;
};

/**
 * Keyed by editor id and the document scene, as the column drag pointer is, so
 * two editors on a page keep their own. No action carries it, so it never
 * reaches the document, the history, a peer or an agent.
 */
const state = observable({
  targets: {} as Record<string, DrawTarget>,
});

const keyOf = (root: RootState) => sceneKeyOf(root, 'document');

const EMPTY: DrawTarget = {
  pointer: null,
  pressPoint: null,
  selfArmed: false,
  targetId: null,
};

const isPoint = (value: unknown): value is Point =>
  typeof value === 'object' && value !== null;

/** Two points the same place count as one, so a pointer at rest writes nothing. */
const isSame = (a: unknown, b: unknown) =>
  a === b || (isPoint(a) && isPoint(b) && a.x === b.x && a.y === b.y);

/** Reads the record through the observable, so a render or an observer tracks it. */
export function getDrawTarget(root: RootState): Readonly<DrawTarget> {
  return state.targets[keyOf(root)] ?? EMPTY;
}

/**
 * Writes the fields given and leaves the rest, each only when it changes, so an
 * observer that reads a field and writes the value it read settles at once.
 */
export function updateDrawTarget(
  root: RootState,
  patch: Partial<DrawTarget>
): void {
  const key = keyOf(root);
  const target = state.targets[key];

  if (!target) {
    state.targets[key] = { ...EMPTY, ...patch };
    return;
  }

  for (const name of Object.keys(patch) as Array<keyof DrawTarget>) {
    if (isSame(target[name], patch[name])) continue;
    Reflect.set(target, name, patch[name]);
  }
}

/** Forgets everything the draw held, as it ends or the canvas goes away. */
export function clearDrawTarget(root: RootState): void {
  if (!(keyOf(root) in state.targets)) return;
  Reflect.deleteProperty(state.targets, keyOf(root));
}
