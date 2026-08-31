// AC-G19: the flip is the one place a Tween takes the draw authority off the
// gate, so every way one can end has to hand it back. A window left open parks
// its layer forever, hence cases about the closing rather than the motion.

import { Layer } from 'konva/lib/Layer';
import { Rect } from 'konva/lib/shapes/Rect';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { markDirty, whenDrawn } from '@/konva/batchDraw';
import { createKonvaFlip, FLIP_DURATION } from '@/konva/scene/konvaFlip';

const stages: Stage[] = [];

function createStage(): Stage {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Stage({ container, width: 200, height: 200 });
  stages.push(stage);
  return stage;
}

function createRow(layer: Layer, y: number): Rect {
  const rect = new Rect({ x: 0, y, width: 40, height: 20, fill: 'red' });
  layer.add(rect);
  return rect;
}

/**
 * Resolves once the gate is idle, and fails rather than hangs when a window
 * was left open — a pending whenDrawn is exactly the failure being guarded.
 */
function settled(timeout = 2000): Promise<void> {
  return Promise.race([
    whenDrawn(),
    new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('the gate never settled')), timeout);
    }),
  ]);
}

const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Where a node is painted, offset included. getAbsolutePosition adds the offset
 * back on purpose, so it answers where the node belongs rather than where the
 * invert is currently holding it.
 */
const drawnY = (node: Rect) => node.getAbsoluteTransform().getTranslation().y;

afterEach(async () => {
  for (const stage of stages.splice(0)) {
    const container = stage.container();
    stage.destroy();
    container.remove();
  }
});

describe('the column reorder flip', () => {
  it('inverts a moved node and tweens it back to where it belongs', async () => {
    const stage = createStage();
    const layer = new Layer();
    stage.add(layer);
    const first = createRow(layer, 0);
    const second = createRow(layer, 24);

    const flip = createKonvaFlip(() => [first, second]);
    flip.snapshot();

    first.y(24);
    second.y(0);
    markDirty(layer);
    await settled();

    // The invert runs on the commit, so each row is drawn back where it was on
    // the frame the reorder lands and travels to its new one over the tween.
    expect(drawnY(first)).toBeCloseTo(0, 5);
    expect(drawnY(second)).toBeCloseTo(24, 5);

    await wait(FLIP_DURATION * 1000 + 150);
    expect(first.offsetY()).toBeCloseTo(0, 5);
    expect(second.offsetY()).toBeCloseTo(0, 5);
    expect(drawnY(first)).toBeCloseTo(24, 5);
    expect(drawnY(second)).toBeCloseTo(0, 5);
  });

  it('leaves a node that did not move alone', async () => {
    const stage = createStage();
    const layer = new Layer();
    stage.add(layer);
    const row = createRow(layer, 0);

    const flip = createKonvaFlip(() => [row]);
    flip.snapshot();
    markDirty(layer);
    await settled();

    expect(row.offsetY()).toBe(0);
  });

  it('hands the layer back when a running flip is cancelled', async () => {
    const stage = createStage();
    const layer = new Layer();
    stage.add(layer);
    const first = createRow(layer, 0);
    const second = createRow(layer, 24);

    const flip = createKonvaFlip(() => [first, second]);
    flip.snapshot();
    first.y(24);
    second.y(0);
    markDirty(layer);
    await settled();

    flip.cancel();

    expect(first.offsetY()).toBe(0);
    expect(second.offsetY()).toBe(0);
    // The gate answers again straight away, which it cannot do while a window
    // on any layer is still open.
    await settled(200);
  });

  it('drops an armed snapshot the drag ended before the commit', async () => {
    const stage = createStage();
    const layer = new Layer();
    stage.add(layer);
    const row = createRow(layer, 0);

    const flip = createKonvaFlip(() => [row]);
    flip.snapshot();
    flip.cancel();

    row.y(24);
    markDirty(layer);
    await settled();

    expect(row.offsetY()).toBe(0);
  });

  it('hands the layer back after a stage the flip was running on is gone', async () => {
    const stage = createStage();
    const layer = new Layer();
    stage.add(layer);
    const first = createRow(layer, 0);
    const second = createRow(layer, 24);

    const flip = createKonvaFlip(() => [first, second]);
    flip.snapshot();
    first.y(24);
    second.y(0);
    markDirty(layer);
    await settled();

    stage.destroy();

    // Nothing will finish the tween now, so the timeout inside the flip is the
    // only thing that can close the window it opened.
    await wait(FLIP_DURATION * 1000 + 400);
    await settled(200);
  });

  it('arms one commit however many times a drag snapshots before it', async () => {
    const stage = createStage();
    const layer = new Layer();
    stage.add(layer);
    const row = createRow(layer, 0);

    const flip = createKonvaFlip(() => [row]);
    flip.snapshot();
    row.y(12);
    flip.snapshot();
    row.y(24);
    markDirty(layer);
    await settled();

    // The last snapshot is the one the invert measures from.
    expect(row.offsetY()).toBeCloseTo(12, 5);
    flip.cancel();
  });

  it('skips a node whose layer hangs on no stage', async () => {
    const layer = new Layer();
    const row = createRow(layer, 0);

    const flip = createKonvaFlip(() => [row]);
    flip.snapshot();
    row.y(24);

    const stage = createStage();
    const other = new Layer();
    stage.add(other);
    markDirty(other);
    await settled();

    expect(row.offsetY()).toBe(0);
    flip.cancel();
  });

  it('falls back to one where a layer has scaled itself to nothing', async () => {
    const stage = createStage();
    const layer = new Layer({ scaleX: 0, scaleY: 0 });
    stage.add(layer);
    const row = createRow(layer, 0);

    const flip = createKonvaFlip(() => [row]);
    flip.snapshot();
    row.y(24);
    markDirty(layer);
    await settled();

    // A zero scale collapses every absolute travel to nothing, so the invert
    // divides by one rather than by zero and the row simply stays put.
    expect(row.offsetY()).toBe(0);
    flip.cancel();
  });

  it('is a no-op to cancel one that was never armed', async () => {
    const flip = createKonvaFlip(() => []);

    expect(() => flip.cancel()).not.toThrow();
    await settled(200);
  });

  it('skips a node the scene dropped between the snapshot and the commit', async () => {
    const stage = createStage();
    const layer = new Layer();
    stage.add(layer);
    const row = createRow(layer, 0);
    const orphan = new Rect({ x: 0, y: 0, width: 40, height: 20 });

    const flip = createKonvaFlip(() => [row, orphan]);
    flip.snapshot();
    row.y(24);
    markDirty(layer);
    await settled();

    expect(orphan.offsetY()).toBe(0);
    flip.cancel();
  });

  it('carries a layer scale through into node units', async () => {
    const stage = createStage();
    const layer = new Layer({ scaleX: 2, scaleY: 2 });
    stage.add(layer);
    const first = createRow(layer, 0);
    const second = createRow(layer, 24);

    const flip = createKonvaFlip(() => [first, second]);
    flip.snapshot();
    first.y(24);
    second.y(0);
    markDirty(layer);
    await settled();

    // The absolute travel is 48 at this scale, and the offset that undoes it
    // is measured in the node's own units.
    expect(first.offsetY()).toBeCloseTo(24, 5);
    flip.cancel();
  });

  it('replaces a running flip rather than stacking a second one on a node', async () => {
    const stage = createStage();
    const layer = new Layer();
    stage.add(layer);
    const row = createRow(layer, 0);

    const flip = createKonvaFlip(() => [row]);
    flip.snapshot();
    row.y(24);
    markDirty(layer);
    await settled();

    flip.snapshot();
    row.y(48);
    markDirty(layer);
    await settled();

    await wait(FLIP_DURATION * 1000 + 200);
    expect(row.offsetY()).toBeCloseTo(0, 5);
    await settled(200);
  });
});
