// P0-2 fallout: four surfaces mount the erd canvas and every one of them
// registers under the same name, so this file drives the open-then-close order
// a person actually takes and asks whether the main stage is still reachable.

import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  installStageTestHandle,
  registerStage,
  type StageRegistry,
  unregisterStage,
} from '@/konva/testHandle';

const CANVAS = 'canvas';
const MINIMAP = 'minimap';

const mounted: Array<{ stage: Stage; name: string }> = [];

function mountStage(name: string): Stage {
  const container = document.createElement('div');
  document.body.append(container);
  const stage = new Stage({ container, width: 120, height: 90 });
  registerStage(name, stage);
  mounted.push({ stage, name });
  return stage;
}

/** The unmount half of mountStage, in the order a component teardown runs it. */
function unmountStage(stage: Stage, name: string): void {
  unregisterStage(name, stage);
  const container = stage.container();
  stage.destroy();
  container.remove();
  const index = mounted.findIndex(entry => entry.stage === stage);
  index === -1 || mounted.splice(index, 1);
}

const registry = (): StageRegistry =>
  Reflect.get(globalThis, '__erdStages') ?? {};

afterEach(() => {
  for (const { stage, name } of mounted.splice(0).reverse()) {
    unregisterStage(name, stage);
    const container = stage.container();
    stage.destroy();
    container.remove();
  }
});

describe('the stage registry a spec reads the scene back through', () => {
  it('installs the registry before any stage has mounted', () => {
    expect(installStageTestHandle()).toBe(registry());
  });

  it('publishes a stage under the name its owner registered', () => {
    const stage = mountStage(CANVAS);

    expect(registry()[CANVAS]).toBe(stage);
  });

  it('keeps the canvas and the minimap apart', () => {
    const canvas = mountStage(CANVAS);
    const minimap = mountStage(MINIMAP);

    expect(registry()[CANVAS]).toBe(canvas);
    expect(registry()[MINIMAP]).toBe(minimap);

    unmountStage(minimap, MINIMAP);

    expect(registry()[CANVAS]).toBe(canvas);
    expect(registry()[MINIMAP]).toBeUndefined();
  });

  it('hands the name to a second surface that mounts over the first', () => {
    mountStage(CANVAS);
    const overlay = mountStage(CANVAS);

    expect(registry()[CANVAS]).toBe(overlay);
  });

  it('leaves the main stage reachable after a surface opens and closes', () => {
    const main = mountStage(CANVAS);
    const overlay = mountStage(CANVAS);

    unmountStage(overlay, CANVAS);

    expect(registry()[CANVAS]).toBe(main);
  });

  it('survives three surfaces opening and closing over the main one', () => {
    const main = mountStage(CANVAS);
    const timeTravel = mountStage(CANVAS);
    const diffViewer = mountStage(CANVAS);
    const placement = mountStage(CANVAS);

    // Closed out of the order they opened in, which is what a tab switch does.
    unmountStage(diffViewer, CANVAS);
    expect(registry()[CANVAS]).toBe(placement);

    unmountStage(placement, CANVAS);
    expect(registry()[CANVAS]).toBe(timeTravel);

    unmountStage(timeTravel, CANVAS);
    expect(registry()[CANVAS]).toBe(main);
  });

  it('drops the name once the last stage holding it unmounts', () => {
    const main = mountStage(CANVAS);
    const overlay = mountStage(CANVAS);

    unmountStage(overlay, CANVAS);
    unmountStage(main, CANVAS);

    expect(registry()[CANVAS]).toBeUndefined();
  });

  it('replaces a claim when the same container takes a new stage', () => {
    const first = mountStage(CANVAS);
    const container = first.container();
    const second = new Stage({ container, width: 120, height: 90 });
    registerStage(CANVAS, second);
    mounted.push({ stage: second, name: CANVAS });

    expect(registry()[CANVAS]).toBe(second);

    unregisterStage(CANVAS, second);

    // The remount threw the first stage away, so nothing is left to fall back
    // to and the name has to go rather than name a stage with no scene in it.
    expect(registry()[CANVAS]).toBeUndefined();
  });

  it('ignores an unregister for a stage that never claimed the name', () => {
    const main = mountStage(CANVAS);
    const stranger = mountStage(MINIMAP);

    unregisterStage(CANVAS, stranger);

    expect(registry()[CANVAS]).toBe(main);
  });

  it('ignores an unregister for a name nothing has claimed', () => {
    const main = mountStage(CANVAS);

    unregisterStage('nothing-holds-this', main);

    expect(registry()[CANVAS]).toBe(main);
    expect(registry()['nothing-holds-this']).toBeUndefined();
  });
});
