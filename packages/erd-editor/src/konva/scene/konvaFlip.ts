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

/** The private attr a fade tweens, and the event namespace it listens under. */
const FADE = 'flipFade';

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

type Running = Map<KonvaNode, () => void>;

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
  const moving: Running = new Map();
  const fading: Running = new Map();
  let snapshots: Snapshot[] | null = null;
  let unlisten: (() => void) | null = null;

  /**
   * Tweens attrs of a node inside a draw window, where running holds the stop
   * of its kind. However the tween ends, settle puts the node at rest first.
   */
  const run = (
    running: Running,
    node: KonvaNode,
    layer: Layer,
    attrs: Record<string, number>,
    settle: () => void,
    onUpdate?: () => void
  ) => {
    beginAnimation(layer);

    let closed = false;
    let timerId: any = -1;

    const close = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timerId);
      running.delete(node);
      settle();
      endAnimation(layer);
    };

    const tween = new Tween({
      node,
      ...attrs,
      duration: FLIP_DURATION,
      easing: Easings.EaseInOut,
      onFinish: close,
      onReset: close,
    });
    tween.onUpdate = onUpdate;

    running.set(node, () => {
      tween.destroy();
      close();
    });

    timerId = setTimeout(() => running.get(node)?.(), CLOSE_TIMEOUT);
    tween.play();
  };

  const start = (node: KonvaNode, layer: Layer, x: number, y: number) => {
    moving.get(node)?.();

    node.offsetX(x);
    node.offsetY(y);

    run(moving, node, layer, { offsetX: 0, offsetY: 0 }, () => {
      node.offsetX(0);
      node.offsetY(0);
    });
  };

  /**
   * Brings a node the commit added up from nothing. Its opacity stays the
   * scene's to write meanwhile, so the tween runs on a private attr and every
   * frame scales whichever opacity the scene wrote last.
   */
  const fade = (node: KonvaNode, layer: Layer) => {
    fading.get(node)?.();

    let opacity = node.opacity();
    let writing = false;

    const apply = () => {
      writing = true;
      node.opacity(opacity * (node.getAttr(FADE) ?? 1));
      writing = false;
    };

    node.on(`opacityChange.${FADE}`, () => {
      if (!writing) opacity = node.opacity();
    });
    node.setAttr(FADE, 0);
    apply();

    const settle = () => {
      node.off(`opacityChange.${FADE}`);
      node.setAttr(FADE, undefined);
      apply();
    };

    run(fading, node, layer, { [FADE]: 1 }, settle, apply);
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

    // A node the commit added has no place it was, so it fades in where it
    // lands rather than being drawn whole under the rows sliding past it.
    const known = new Set(taken.map(({ node }) => node));
    for (const node of nodes()) {
      const layer = node.getLayer();
      if (known.has(node) || !layer || !node.getStage()) continue;

      fade(node, layer);
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
      [...moving.values(), ...fading.values()].forEach(stop => stop());
    },
  };
}
