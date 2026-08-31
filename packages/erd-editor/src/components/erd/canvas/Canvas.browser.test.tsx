// P3-27: the dom shell only. What the scene draws inside the Stage is
// CanvasScene.browser.test.tsx, and the shell's own contract is the two boxes,
// the Stage that hangs in the inner one and the size both take.

import { createRef, useProvider } from '@dineug/r-html';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import Canvas from '@/components/erd/canvas/Canvas';
import * as styles from '@/components/erd/canvas/Canvas.styles';
import { themeContext } from '@/components/themeContext';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const stageRegistry = (): Record<string, Stage> =>
  Reflect.get(globalThis, '__erdStages') ?? {};

async function mountCanvas(grabMove?: boolean): Promise<Mounted> {
  const $root = document.createElement('div');
  document.body.append($root);
  const root = createRef<HTMLDivElement>($root);
  const canvas = createRef<HTMLDivElement>();
  const app = createTestAppContext();
  const mounted = mount(
    <Canvas root={root} canvas={canvas} grabMove={grabMove} />,
    app
  );
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  await flush();
  await whenDrawn();

  teardowns.push(() => {
    mounted.unmount();
    themeProvider.destroy();
    $root.remove();
  });

  return mounted;
}

const controllerOf = (mounted: Mounted) =>
  mounted.container.firstElementChild as HTMLDivElement;

const containerOf = (mounted: Mounted) =>
  controllerOf(mounted).firstElementChild as HTMLDivElement;

describe('the canvas shell', () => {
  it('sizes both boxes from the viewport rather than the canvas', async () => {
    const mounted = await mountCanvas();
    mounted.app.store.dispatchSync(
      changeViewportAction({ width: 800, height: 600 })
    );
    await flush();

    for (const el of [controllerOf(mounted), containerOf(mounted)]) {
      expect(el.style.width).toBe('800px');
      expect(el.style.height).toBe('600px');
      expect(el.style.minWidth).toBe('800px');
      expect(el.style.minHeight).toBe('600px');
    }
  });

  it('writes no transform of its own, the layers carry it now', async () => {
    const mounted = await mountCanvas();
    const { store } = mounted.app;

    store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
    await flush();

    expect(controllerOf(mounted).style.transform).toBe('');
    expect(containerOf(mounted).style.transform).toBe('');
  });

  it('keeps pointer events on the controller by default', async () => {
    const mounted = await mountCanvas();

    expect(controllerOf(mounted).style.pointerEvents).toBe('auto');
    expect(controllerOf(mounted).getAttribute('class')).toContain(
      String(styles.controller)
    );
  });

  it('disables pointer events on the controller while grab moving', async () => {
    const mounted = await mountCanvas(true);

    expect(controllerOf(mounted).style.pointerEvents).toBe('none');
  });

  it('marks the inner box as the canvas and binds the ref to it', async () => {
    const mounted = await mountCanvas();
    const el = containerOf(mounted);

    expect(el.dataset.testid).toBe('erd-canvas');
    expect(el.getAttribute('class')).toContain(String(styles.root));
    expect(stageRegistry().canvas.container()).toBe(el);
  });

  it('mounts one Stage of three layers in the inner box', async () => {
    await mountCanvas();
    const stage = stageRegistry().canvas;

    expect(stage.getLayers().map(layer => layer.name())).toEqual([
      'scene',
      'overlay-marquee',
      'presence',
    ]);
  });

  it('resizes the Stage with the viewport', async () => {
    const mounted = await mountCanvas();
    const stage = stageRegistry().canvas;

    mounted.app.store.dispatchSync(
      changeViewportAction({ width: 640, height: 480 })
    );
    await flush();

    expect(stage.width()).toBe(640);
    expect(stage.height()).toBe(480);
  });

  it('drops the Stage and its registry entry on unmount', async () => {
    const mounted = await mountCanvas();
    const stage = stageRegistry().canvas;

    teardowns.splice(0).forEach(teardown => teardown());
    await whenDrawn();

    expect(stageRegistry().canvas).toBeUndefined();
    expect(stage.getLayers()).toHaveLength(0);
    expect(mounted.container.isConnected).toBe(false);
  });
});
