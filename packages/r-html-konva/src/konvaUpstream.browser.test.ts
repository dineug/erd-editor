// Upstream pin, not a test of our code: these two konva behaviours are what the
// batchDraw gate and the zIndex ban are built on, and neither is a documented
// guarantee. A konva upgrade that flips either one fails here first.

import { Animation } from 'konva/lib/Animation';
import Konva from 'konva/lib/Core';
import { Group } from 'konva/lib/Group';
import { Layer } from 'konva/lib/Layer';
import { Rect } from 'konva/lib/shapes/Rect';
import { Stage } from 'konva/lib/Stage';
import { Tween } from 'konva/lib/Tween';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

const ANIMATION_FRAMES = 4;

const stages: Stage[] = [];

let autoDrawEnabled = Konva.autoDrawEnabled;

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

function spyOnBatchDraw(layer: Layer) {
  const original = layer.batchDraw.bind(layer);
  return vi.spyOn(layer, 'batchDraw').mockImplementation(() => original());
}

function runAnimation(layer: Layer, func: () => void | boolean): Promise<void> {
  return new Promise(resolve => {
    let frames = 0;
    const animation = new Animation(() => {
      frames += 1;
      const result = func();
      if (frames >= ANIMATION_FRAMES) {
        animation.stop();
        resolve();
      }
      return result;
    }, layer);
    animation.start();
  });
}

beforeEach(() => {
  autoDrawEnabled = Konva.autoDrawEnabled;
});

afterEach(() => {
  Konva.autoDrawEnabled = autoDrawEnabled;
  for (const stage of stages.splice(0)) {
    const container = stage.container();
    stage.destroy();
    container.remove();
  }
  vi.restoreAllMocks();
});

describe('konva 10.3.2 draws through Konva.autoDrawEnabled = false while animating', () => {
  it('draws nothing for a plain attr write, which is what the flag buys', () => {
    Konva.autoDrawEnabled = false;
    const layer = createLayer(createStage());
    const rect = new Rect({ width: 10, height: 10, fill: 'red' });
    layer.add(rect);
    const batchDraw = spyOnBatchDraw(layer);

    rect.x(5);

    expect(batchDraw).not.toHaveBeenCalled();
  });

  it('draws once per Animation frame regardless of the flag', async () => {
    Konva.autoDrawEnabled = false;
    const layer = createLayer(createStage());
    layer.add(new Rect({ width: 10, height: 10, fill: 'red' }));
    const batchDraw = spyOnBatchDraw(layer);

    await runAnimation(layer, () => undefined);

    expect(batchDraw).toHaveBeenCalledTimes(ANIMATION_FRAMES);
    expect(Konva.autoDrawEnabled).toBe(false);
  });

  it('skips the draw only for an Animation callback that returns false', async () => {
    Konva.autoDrawEnabled = false;
    const layer = createLayer(createStage());
    layer.add(new Rect({ width: 10, height: 10, fill: 'red' }));
    const batchDraw = spyOnBatchDraw(layer);

    await runAnimation(layer, () => false);

    expect(batchDraw).not.toHaveBeenCalled();
  });

  it('draws for a Tween, whose own callback can never return false', async () => {
    Konva.autoDrawEnabled = false;
    const layer = createLayer(createStage());
    const rect = new Rect({ width: 10, height: 10, fill: 'red' });
    layer.add(rect);
    const batchDraw = spyOnBatchDraw(layer);

    await new Promise<void>(resolve => {
      new Tween({
        node: rect,
        duration: 0.1,
        x: 50,
        onFinish: () => resolve(),
      }).play();
    });

    expect(batchDraw.mock.calls.length).toBeGreaterThan(0);
    expect(Konva.autoDrawEnabled).toBe(false);
    expect(rect.x()).toBe(50);
  });
});

describe('konva 10.3.2 routes setAttrs zIndex through setZIndex', () => {
  function createSiblings() {
    const parent = new Group();
    createLayer(createStage()).add(parent);
    const a = new Group({ name: 'a' });
    const b = new Group({ name: 'b' });
    const c = new Group({ name: 'c' });
    parent.add(a, b, c);
    return { parent, a, b, c };
  }

  function names(parent: Group): string[] {
    return parent.getChildren().map(child => child.name());
  }

  it('reorders siblings through the setter, not through an attr write', () => {
    const { parent, c } = createSiblings();
    const setZIndex = vi.spyOn(c, 'setZIndex');

    c.setAttrs({ zIndex: 0 });

    expect(setZIndex).toHaveBeenCalledTimes(1);
    expect(setZIndex).toHaveBeenCalledWith(0);
    expect(names(parent)).toEqual(['c', 'a', 'b']);
  });

  it('still reorders when zIndex rides along with ordinary attrs', () => {
    const { parent, c } = createSiblings();
    const setZIndex = vi.spyOn(c, 'setZIndex');

    c.setAttrs({ x: 3, zIndex: 1, y: 4 });

    expect(setZIndex).toHaveBeenCalledExactlyOnceWith(1);
    expect(names(parent)).toEqual(['a', 'c', 'b']);
    expect(c.x()).toBe(3);
    expect(c.y()).toBe(4);
  });

  it('leaves no zIndex key behind, so an attrs diff can never see the reorder', () => {
    const { c } = createSiblings();

    c.setAttrs({ zIndex: 0 });

    expect(Object.keys(c.attrs)).not.toContain('zIndex');
    expect(Object.keys(c.clone().attrs)).not.toContain('zIndex');
  });

  it('warns and ignores the reorder for a node with no parent', () => {
    const warn = vi
      .spyOn(Konva.Util, 'warn')
      .mockImplementation(() => undefined);
    const orphan = new Group({ name: 'orphan' });

    orphan.setAttrs({ zIndex: 2 });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(orphan.getParent()).toBeNull();
  });
});
