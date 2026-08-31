// AC-G18 and AC-G19: a commit is the fixed point microtask flush, and a Tween
// window hands the draw authority over for its duration. Per Layer batchDraw
// counts are the whole judgement, so every case spies on it.

import { nextTick } from '@dineug/r-html';
import Konva from 'konva/lib/Core';
import { Layer } from 'konva/lib/Layer';
import { Rect } from 'konva/lib/shapes/Rect';
import { Stage } from 'konva/lib/Stage';
import { Tween } from 'konva/lib/Tween';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  beginAnimation,
  currentEpoch,
  endAnimation,
  markDirty,
  whenDrawn,
} from '@/konva/batchDraw';

const stages: Stage[] = [];

function createStage(): Stage {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Stage({ container, width: 120, height: 120 });
  stages.push(stage);
  return stage;
}

function createLayer(stage: Stage): Layer {
  const layer = new Layer();
  stage.add(layer);
  return layer;
}

function addRect(layer: Layer): Rect {
  const rect = new Rect({ width: 10, height: 10, fill: 'red' });
  layer.add(rect);
  return rect;
}

function spyOnBatchDraw(layer: Layer, onDraw?: () => void) {
  const original = layer.batchDraw.bind(layer);
  return vi.spyOn(layer, 'batchDraw').mockImplementation(() => {
    onDraw?.();
    return original();
  });
}

/** Runs the queued hops of a settled chain without yielding to a task. */
async function microtasks(): Promise<void> {
  for (let index = 0; index < 4; index++) {
    await Promise.resolve();
  }
}

afterEach(async () => {
  await whenDrawn();

  for (const stage of stages.splice(0)) {
    const container = stage.container();
    stage.destroy();
    container.remove();
  }

  vi.restoreAllMocks();
});

describe('batchDraw commit boundary (AC-G18)', () => {
  it('draws each dirty layer exactly once and leaves an untouched one alone', async () => {
    const stage = createStage();
    const scene = createLayer(stage);
    const overlay = createLayer(stage);
    const presence = createLayer(stage);
    const nodes = [addRect(scene), addRect(scene), addRect(scene)];
    const banner = addRect(overlay);
    addRect(presence);
    const sceneDraw = spyOnBatchDraw(scene);
    const overlayDraw = spyOnBatchDraw(overlay);
    const presenceDraw = spyOnBatchDraw(presence);
    const before = currentEpoch();

    nodes.forEach((rect, index) => {
      rect.x(index);
      markDirty(scene);
    });
    banner.y(4);
    markDirty(overlay);

    expect(sceneDraw).not.toHaveBeenCalled();

    await whenDrawn();

    expect(Konva.autoDrawEnabled).toBe(false);
    expect(sceneDraw).toHaveBeenCalledTimes(1);
    expect(overlayDraw).toHaveBeenCalledTimes(1);
    expect(presenceDraw).not.toHaveBeenCalled();
    expect(currentEpoch()).toBe(before + 1);
  });

  it('folds a task pushed during the scheduler drain into the same commit', async () => {
    const layer = createLayer(createStage());
    const rect = addRect(layer);
    const seen: number[] = [];
    const draw = spyOnBatchDraw(layer, () => seen.push(rect.x()));
    const before = currentEpoch();

    await nextTick(() => {
      rect.x(1);
      markDirty(layer);
      // Pushed while executeAsap is still draining, so it runs in that drain.
      nextTick(() => {
        rect.x(2);
        markDirty(layer);
      });
    });
    await whenDrawn();

    expect(draw).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([2]);
    expect(currentEpoch()).toBe(before + 1);
  });

  it('draws once, after the dispatch, for a write then dispatch handler', async () => {
    const layer = createLayer(createStage());
    const rect = addRect(layer);
    const seen: number[] = [];
    const draw = spyOnBatchDraw(layer, () => seen.push(rect.x()));
    const before = currentEpoch();

    // The synchronous handler: attrs first, then the action it dispatches.
    rect.x(1);
    markDirty(layer);
    const dispatched = nextTick(() => {
      rect.x(2);
      markDirty(layer);
    });

    await whenDrawn();

    expect(draw).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([2]);
    expect(currentEpoch()).toBe(before + 1);

    await dispatched;
  });

  it('resolves whenDrawn at once when nothing is armed', async () => {
    const layer = createLayer(createStage());
    const draw = spyOnBatchDraw(layer);
    let settled = false;
    const idle = whenDrawn().then(() => {
      settled = true;
    });

    await microtasks();

    expect(settled).toBe(true);
    expect(draw).not.toHaveBeenCalled();

    await idle;
  });
});

describe('Tween windows (AC-G19)', () => {
  it('parks a mark made inside the window and keeps whenDrawn pending', async () => {
    const layer = createLayer(createStage());
    const rect = addRect(layer);
    const draw = spyOnBatchDraw(layer);
    let settled = false;

    beginAnimation(layer);
    rect.x(1);
    markDirty(layer);
    markDirty(layer);
    const pending = whenDrawn().then(() => {
      settled = true;
    });

    await microtasks();

    expect(draw).not.toHaveBeenCalled();
    expect(settled).toBe(false);

    endAnimation(layer);
    await whenDrawn();
    await microtasks();

    expect(draw).toHaveBeenCalledTimes(1);
    expect(settled).toBe(true);

    await pending;
  });

  it('holds the window open until the last Tween on the layer has finished', async () => {
    const layer = createLayer(createStage());
    const draw = spyOnBatchDraw(layer);

    beginAnimation(layer);
    beginAnimation(layer);
    markDirty(layer);
    endAnimation(layer);

    await microtasks();

    expect(draw).not.toHaveBeenCalled();

    endAnimation(layer);
    await whenDrawn();

    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('defers whenDrawn while any layer animates, drawn layers included', async () => {
    const stage = createStage();
    const scene = createLayer(stage);
    const overlay = createLayer(stage);
    const sceneDraw = spyOnBatchDraw(scene);
    let settled = false;

    beginAnimation(overlay);
    markDirty(scene);
    const pending = whenDrawn().then(() => {
      settled = true;
    });

    await microtasks();

    expect(sceneDraw).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    endAnimation(overlay);
    await microtasks();

    expect(settled).toBe(true);

    await pending;
  });

  it('draws once per Tween frame and once more for the parked commit', async () => {
    const layer = createLayer(createStage());
    const rect = addRect(layer);
    const parked = addRect(layer);
    const drawFrames: number[] = [];
    let frames = 0;
    const draw = spyOnBatchDraw(layer, () => drawFrames.push(frames));

    const finished = new Promise<void>(resolve => {
      const tween = new Tween({
        node: rect,
        duration: 0.1,
        x: 50,
        onUpdate: () => {
          parked.y(parked.y() + 1);
          markDirty(layer);
        },
        onFinish: () => {
          endAnimation(layer);
          resolve();
        },
      });
      const runFrame = tween.anim.func;
      tween.anim.func = () => {
        frames += 1;
        return runFrame(tween.anim.frame);
      };

      // FLIP order: the first position is written before the window opens, so
      // the gate is already armed when the Tween takes the layer over.
      rect.x(0);
      markDirty(layer);
      beginAnimation(layer);
      tween.play();
    });

    await finished;
    await whenDrawn();

    const tweenFrames = Array.from({ length: frames }, (_, index) => index + 1);

    expect(frames).toBeGreaterThan(0);
    expect(drawFrames).toEqual([...tweenFrames, frames]);
    expect(draw).toHaveBeenCalledTimes(frames + 1);
    expect(rect.x()).toBe(50);
    expect(parked.y()).toBeGreaterThan(0);
  });
});
