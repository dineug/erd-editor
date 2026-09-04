import type { Layer } from 'konva/lib/Layer';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { Easings, Tween } from 'konva/lib/Tween';

import { beginAnimation, endAnimation, onBeforeFlush } from '@/konva/batchDraw';

/** The 0.3s transform transition Table.styles gave the dom column-row-move. */
export const FLIP_DURATION = 0.3;

/**
 * The grace a window waits before it closes itself. A Tween that never reaches
 * its last frame would otherwise leave its layer animating forever, and the
 * draw gate would never draw it or release a whenDrawn again.
 */
const CLOSE_TIMEOUT = FLIP_DURATION * 1000 + 200;

export type KonvaFlip = {
  /**
   * Records where the nodes are now and arms the invert for the commit that
   * follows. Called before dispatching the change that moves them.
   */
  snapshot(): void;
  /** Ends every running tween at once and hands its layer back to the gate. */
  cancel(): void;
};

type Snapshot = { node: KonvaNode; x: number; y: number };

/**
 * The offset a node carries to look like it is still where it was. A konva
 * offset shifts the origin, so the travel is subtracted from the new place and
 * divided out of the layer scale to reach node units.
 */
function invertOffset(node: KonvaNode, before: Snapshot) {
  const after = node.getAbsolutePosition();
  const scale = node.getAbsoluteScale();

  return {
    x: (after.x - before.x) / (scale.x || 1),
    y: (after.y - before.y) / (scale.y || 1),
  };
}

/**
 * FLIP over konva's own Tween, for a reorder the scene has already committed.
 * The tween owns the draw for the layer it runs on, and every way one can end —
 * finish, reset, cancel, timeout — hands that authority back exactly once.
 */
export function createKonvaFlip(nodes: () => KonvaNode[]): KonvaFlip {
  const running = new Map<KonvaNode, () => void>();
  let snapshots: Snapshot[] | null = null;
  let unlisten: (() => void) | null = null;

  const start = (node: KonvaNode, layer: Layer, x: number, y: number) => {
    running.get(node)?.();

    node.offsetX(x);
    node.offsetY(y);
    beginAnimation(layer);

    let closed = false;
    let timerId: any = -1;

    const close = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timerId);
      running.delete(node);
      endAnimation(layer);
    };

    const tween = new Tween({
      node,
      offsetX: 0,
      offsetY: 0,
      duration: FLIP_DURATION,
      easing: Easings.EaseInOut,
      onFinish: close,
      onReset: close,
    });

    running.set(node, () => {
      tween.destroy();
      node.offsetX(0);
      node.offsetY(0);
      close();
    });

    timerId = setTimeout(() => running.get(node)?.(), CLOSE_TIMEOUT);
    tween.play();
  };

  /** Drops the armed snapshot and its flush hook, handing back what was armed. */
  const disarm = () => {
    const taken = snapshots;
    snapshots = null;
    unlisten?.();
    unlisten = null;
    return taken;
  };

  const play = () => {
    const taken = disarm();
    if (!taken) return;

    for (const before of taken) {
      const { node } = before;
      const layer = node.getLayer();
      if (!layer || !node.getStage()) continue;

      const { x, y } = invertOffset(node, before);
      if (!x && !y) continue;

      start(node, layer, x, y);
    }
  };

  return {
    snapshot() {
      snapshots = nodes().map(node => {
        const { x, y } = node.getAbsolutePosition();
        return { node, x, y };
      });

      // The host reconciles on the same hook and registered first, so the tree
      // already carries the new positions by the time this runs.
      unlisten ??= onBeforeFlush(play);
    },
    cancel() {
      disarm();
      [...running.values()].forEach(stop => stop());
    },
  };
}
