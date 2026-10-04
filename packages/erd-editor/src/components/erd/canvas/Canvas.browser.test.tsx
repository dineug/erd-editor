// P3-27: the dom shell only. What the scene draws inside the Stage is
// CanvasScene.browser.test.tsx, and the shell's own contract is the two boxes,
// the Stage that hangs in the inner one, the size both take and the middle pan.

import { createRef, useProvider } from '@dineug/r-html';
import type { Group } from 'konva/lib/Group';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
  movePointer,
  releasePointer,
  whenPainted,
} from '@/__test-utils__';
import Canvas from '@/components/erd/canvas/Canvas';
import * as styles from '@/components/erd/canvas/Canvas.styles';
import { themeContext } from '@/components/themeContext';
import {
  changeViewportAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
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
    expect(el.getAttribute('class')).toContain(String(styles.stage));
    expect(stageRegistry().canvas.container()).toBe(el);
  });

  it('mounts one Stage of four layers in the inner box, background first', async () => {
    await mountCanvas();
    const stage = stageRegistry().canvas;

    expect(stage.getLayers().map(layer => layer.name())).toEqual([
      'canvas-background',
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

/** Two tables on an 800 by 600 screen, the second of them selected. */
async function mountScene() {
  const mounted = await mountCanvas();
  mounted.app.store.dispatchSync(
    changeViewportAction({ width: 800, height: 600 }),
    addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 2 } }),
    addTableAction({ id: 't2', ui: { x: 500, y: 300, zIndex: 3 } }),
    selectAction({ t2: SelectType.table })
  );
  await flush();
  await whenDrawn();
  // The hit graph a pointer is tested against lands a frame after the draw.
  await whenPainted();

  return { mounted, stage: stageRegistry().canvas };
}

/** The viewport point at the middle of a scene node, which konva resolves the node from. */
function pointOf(stage: Stage, node: string, child?: string) {
  const found = stage.findOne<Group>(node)!;
  const target = child ? found.findOne(child)! : found;
  const rect = target.getClientRect({ relativeTo: stage, skipShadow: true });
  const content = stage.content.getBoundingClientRect();

  return {
    clientX: content.left + rect.x + rect.width / 2,
    clientY: content.top + rect.y + rect.height / 2,
  };
}

/** A real mouse event on the canvas konva draws in, at a viewport point. */
function fire(
  stage: Stage,
  type: string,
  at: { clientX: number; clientY: number },
  button: number
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    button,
    buttons: type === 'mousedown' ? 1 << button : 0,
    ...at,
  });
  stage.content.querySelector('canvas')!.dispatchEvent(event);
  return event;
}

/** Anchors the move stream far from the scene, as a press the window heard last would. */
function pressElsewhere() {
  window.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
  releasePointer();
}

const MIDDLE = 1;

const MAIN = 0;

describe('a middle button press on the scene', () => {
  it('pans the document from over a table, and leaves the table and the selection be', async () => {
    const { mounted, stage } = await mountScene();
    const { store } = mounted.app;
    const at = pointOf(stage, '#table-t1');
    pressElsewhere();

    const press = fire(stage, 'mousedown', at, MIDDLE);
    movePointer(at.clientX + 15, at.clientY + 10);
    movePointer(at.clientX + 40, at.clientY + 30);
    releasePointer(at.clientX + 40, at.clientY + 30);
    await flush();

    expect(press.defaultPrevented).toBe(true);
    // The first step is measured from the press, not from the corner the
    // stream heard last, so the origin moves by the pointer travel alone.
    expect(store.state.settings.originX).toBe(40);
    expect(store.state.settings.originY).toBe(30);
    expect(store.state.collections.tableEntities.t1.ui).toMatchObject({
      x: 100,
      y: 100,
    });
    expect({ ...store.state.editor.selectedMap }).toEqual({
      t2: SelectType.table,
    });
  });

  it('sends nothing for a step that did not move', async () => {
    const { mounted, stage } = await mountScene();
    const { store } = mounted.app;
    const at = pointOf(stage, '#table-t1');
    const types: string[] = [];
    store.subscribe(actions => types.push(...actions.map(({ type }) => type)));

    fire(stage, 'mousedown', at, MIDDLE);
    const move = movePointer(at.clientX, at.clientY);
    await flush();

    expect(move.defaultPrevented).toBe(true);
    expect(types).toEqual([]);
  });

  it('removes nothing from a click on a table remove button, which the main button removes', async () => {
    const { mounted, stage } = await mountScene();
    const { store } = mounted.app;
    const at = pointOf(stage, '#table-t1', '.table-remove');

    fire(stage, 'mousedown', at, MIDDLE);
    fire(stage, 'mouseup', at, MIDDLE);
    await flush();
    await whenDrawn();

    expect(store.state.doc.tableIds).toEqual(['t1', 't2']);
    expect({ ...store.state.editor.selectedMap }).toEqual({
      t2: SelectType.table,
    });

    // The same point under the main button is the button, which shows the
    // point the middle click went to is the one the button answers.
    await whenPainted();
    fire(stage, 'mousedown', at, MAIN);
    fire(stage, 'mouseup', at, MAIN);
    await flush();

    expect(store.state.doc.tableIds).toEqual(['t2']);
  });

  it('lets konva hear no lift of it, so a main click after it on the same table is no double click', async () => {
    const { stage } = await mountScene();
    const at = pointOf(stage, '#table-t1');
    const heard: string[] = [];
    stage.on('mouseup dblclick', event => heard.push(event.type));

    fire(stage, 'mousedown', at, MIDDLE);
    const lift = fire(stage, 'mouseup', at, MIDDLE);

    expect(lift.defaultPrevented).toBe(true);
    expect(heard).toEqual([]);

    fire(stage, 'mousedown', at, MAIN);
    fire(stage, 'mouseup', at, MAIN);

    expect(heard).toEqual(['mouseup']);
  });

  it('asks the colour picker of the document scene to close', async () => {
    const { mounted, stage } = await mountScene();
    const closeColorPicker = vi.fn();
    mounted.app.emitter.on({ closeColorPicker });

    fire(stage, 'mousedown', pointOf(stage, '#table-t2'), MIDDLE);

    expect(closeColorPicker).toHaveBeenCalledOnce();
  });
});
