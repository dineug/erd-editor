import { DD } from 'konva/lib/DragAndDrop';
import { Konva } from 'konva/lib/Global';
import type { Layer } from 'konva/lib/Layer';
import { Stage } from 'konva/lib/Stage';

// This gate is the only draw authority outside an animation, so konva's own
// attr setters must not redraw behind it.
Konva.autoDrawEnabled = false;

// Konva.isDragging reads Konva.DD, and only konva's own barrel assigns it. This
// package names konva/lib paths instead, so registering it here is what keeps a
// Stage pointermove from throwing before it dispatches enter, leave or move.
Reflect.set(Konva, 'DD', DD);

const dirty = new Set<Layer>();
const deferred = new Set<Layer>();
const animating = new Map<Layer, number>();
const waiters: Array<() => void> = [];
const endWaiters: Array<() => void> = [];
const listeners = new Set<() => void>();

let armed = false;
let dirtySinceHop = false;
let epoch = 0;

/**
 * The commit counter the host's epoch scoped reconcile reads. It advances once
 * per flush and never on a deferred hop, so one commit reconciles a parent at
 * most once however many hops the fixed point took.
 */
export function currentEpoch(): number {
  return epoch;
}

/**
 * One commit: settle the scene, draw each dirty layer once, then release the
 * waiters. A layer a Tween has claimed since it was marked is parked rather
 * than drawn, leaving the animation the only thing drawing it.
 */
function flush() {
  epoch += 1;

  try {
    // The gate stays armed here, so a listener marking a layer joins this draw
    // instead of buying a hop of its own.
    listeners.forEach(listener => listener());
  } finally {
    armed = false;
    dirtySinceHop = false;

    for (const layer of dirty) {
      if (animating.has(layer)) {
        deferred.add(layer);
        continue;
      }

      // A layer no Stage owns has nowhere to draw, and konva's own batchDraw
      // reaches through the parent for a window it would not find there.
      layer.getStage() instanceof Stage && layer.batchDraw();
    }

    dirty.clear();
    waiters.splice(0).forEach(resolve => resolve());
  }
}

/**
 * Registers work that settles the scene before a commit draws it. The host
 * reconciles its ledger here, which is what makes the flush the one boundary
 * where the konva tree and the ledger are known to agree.
 */
export function onBeforeFlush(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * A microtask hop that draws only at the fixed point: dirt arriving since the
 * last hop buys another hop, which is what folds the synchronous writes around
 * a scheduler drain into the same commit as the drain itself.
 */
function hop() {
  queueMicrotask(() => {
    if (dirtySinceHop) {
      dirtySinceHop = false;
      hop();
      return;
    }

    flush();
  });
}

/**
 * Arms the gate without naming a layer, for a change that has to reach the
 * fixed point but nothing to draw yet. The arming mark counts as dirt itself,
 * so the commit always lands at least one hop later than the write.
 */
export function requestFlush(): void {
  dirtySinceHop = true;
  if (armed) return;

  armed = true;
  hop();
}

/**
 * Records that a layer needs redrawing and arms the gate. A layer a Tween has
 * claimed is parked instead, and the end of that window hands it back.
 */
export function markDirty(layer: Layer): void {
  if (animating.has(layer)) {
    deferred.add(layer);
    return;
  }

  dirty.add(layer);
  requestFlush();
}

/**
 * Hands the draw authority for one layer to a Tween, whose animation frame
 * draws it. Windows count rather than latch, because one FLIP tweens many
 * nodes of a layer and each of them opens and closes its own.
 */
export function beginAnimation(layer: Layer): void {
  animating.set(layer, (animating.get(layer) ?? 0) + 1);
}

/**
 * Closes one Tween window and, with the last one on a layer, hands the marks
 * parked meanwhile back to the gate as a single re-arm.
 */
export function endAnimation(layer: Layer): void {
  const open = (animating.get(layer) ?? 0) - 1;
  open > 0 ? animating.set(layer, open) : animating.delete(layer);

  endWaiters.splice(0).forEach(resolve => resolve());

  if (open <= 0 && deferred.delete(layer)) {
    markDirty(layer);
  }
}

/** Resolves on the next endAnimation, whichever layer it closes. */
function nextEndAnimation(): Promise<void> {
  return new Promise<void>(resolve => {
    endWaiters.push(() => resolve());
  });
}

/**
 * Resolves once the scene has settled. An open Tween window anywhere defers
 * the answer to the end of that window, an armed gate to its flush, and an
 * idle gate answers at once so a call after a flush never hangs.
 */
export function whenDrawn(): Promise<void> {
  if (animating.size) return nextEndAnimation().then(whenDrawn);
  if (!armed) return Promise.resolve();

  return new Promise<void>(resolve => {
    waiters.push(() => resolve());
  });
}
