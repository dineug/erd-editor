import { observable } from '@dineug/r-html';

/** The time and the frame a transition runs on, so a spec can step it and count its frames. */
export type TransitionClock = {
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
};

/** The clock every shipped transition runs on: wall time and the browser's own animation frame. */
export const transitionClock: TransitionClock = {
  now: () => performance.now(),
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: handle => cancelAnimationFrame(handle),
};

/** How long a highlight takes to come up or go out, which is the one liam gives its edges. */
export const TRANSITION_MS = 300;

type Transition = { from: number; to: number; startedAt: number };

/**
 * Where each key rests. A key with no entry has never been asked for, and the
 * first ask settles it there rather than moving it, so nothing animates itself
 * onto the screen as it mounts.
 */
const targets = new Map<string, number>();

/** The keys moving right now, and where each one started; a key settles by leaving this. */
const running = new Map<string, Transition>();

/**
 * Where a moving key stands this frame, written by the frame and read by a
 * render, so the scene redraws through the ordinary commit gate. A key that is
 * not moving is absent, and its target below is what a reader gets instead.
 */
const progress = observable({} as Record<string, number>);

let clock: TransitionClock = transitionClock;
let handle: number | null = null;

/** Ease out. The particle's own curve is ease in out and lives in its own module; the two are not shared. */
function easeOut(t: number): number {
  const rest = 1 - t;

  return 1 - rest * rest * rest;
}

function arm(): void {
  if (handle !== null || running.size === 0) return;

  handle = clock.requestFrame(frame);
}

function drop(key: string): void {
  running.delete(key);
  if (progress[key] !== undefined) Reflect.deleteProperty(progress, key);
}

/**
 * One frame: every moving key is written where its clock puts it, and a key
 * past the duration is written onto its target and stops moving. The next
 * frame is asked for only while something is still moving.
 */
function frame(): void {
  handle = null;
  const now = clock.now();

  for (const [key, transition] of [...running]) {
    const elapsed = now - transition.startedAt;
    const { from, to } = transition;

    if (elapsed >= TRANSITION_MS) {
      running.delete(key);
      // Written rather than dropped, since a walk that lands on its first
      // frame has written nothing yet and a deletion of nothing tells no one.
      progress[key] = to;
      continue;
    }

    const t = elapsed > 0 ? elapsed / TRANSITION_MS : 0;
    progress[key] = from + (to - from) * easeOut(t);
  }

  arm();
}

/**
 * The key one transition is held under. The editor id leads so a scene that
 * closes drops its own keys and no one else's, and the kind separates a table
 * from a connector that was minted the same id.
 */
export function transitionKey(
  editorId: string,
  kind: string,
  id: string
): string {
  return `${editorId} ${kind}:${id}`;
}

/**
 * What the key shows now: where the frame last put it, or the target it rests
 * at. Reading a key that is not moving arms nothing, which is what keeps this
 * module frameless in the export worker that carries it.
 */
export function progressOf(key: string): number {
  const live = progress[key];
  if (live !== undefined) return live;

  // A key sent off this commit has no frame behind it yet, and where it stands
  // is where it left rather than where it is going.
  const moving = running.get(key);

  return moving ? moving.from : (targets.get(key) ?? 0);
}

/**
 * Sends a key toward the target given. A key already heading there is left
 * alone, and a key asked for the first time settles on the target at once, so
 * only a change a reader could have watched is animated.
 */
export function transitionTo(key: string, target: number): void {
  const held = targets.get(key);
  if (held === target) return;

  if (held === undefined) {
    targets.set(key, target);
    return;
  }

  // Read before the target moves, since the target is where a key that is not
  // moving already stands, and that is the value this walk starts from.
  const from = progressOf(key);
  targets.set(key, target);
  running.set(key, { from, to: target, startedAt: clock.now() });
  arm();
}

/** Drops every key one editor holds and cancels the frame if nothing else is moving. */
export function stopTransitions(editorId: string): void {
  const prefix = `${editorId} `;

  for (const key of [...targets.keys()]) {
    if (!key.startsWith(prefix)) continue;

    targets.delete(key);
    drop(key);
  }

  if (running.size === 0 && handle !== null) {
    clock.cancelFrame(handle);
    handle = null;
  }
}

/**
 * Runs the transitions on the clock given, or on the browser's own again when
 * called with nothing. Whatever was moving lands on its target, since a start
 * time taken from one clock means nothing against another.
 */
export function setTransitionClock(
  next: TransitionClock = transitionClock
): void {
  if (handle !== null) {
    clock.cancelFrame(handle);
    handle = null;
  }

  for (const key of [...running.keys()]) drop(key);

  clock = next;
}
