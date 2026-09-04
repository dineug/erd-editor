import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { Diff, DiffMap } from '@/components/erd/diff-viewer/diff';
import ErdViewer from '@/components/erd/diff-viewer/erd-viewer/ErdViewer';
import * as styles from '@/components/erd/diff-viewer/erd-viewer/ErdViewer.styles';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  window.dispatchEvent(new MouseEvent('mouseup'));
});

function createApp(): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 1000, height: 800 }));
  return app;
}

const diffMapOf = (): DiffMap =>
  new Map([['t1', ['tableEntities', new Map([['tableName', Diff.insert]])]]]);

async function mountViewer(
  diff: number,
  diffMap: DiffMap = new Map(),
  app: AppContext = createApp()
) {
  mounted = await mountAndFlush(
    html`<${ErdViewer} app=${app} diff=${diff} diffMap=${diffMap} />`
  );
  const root = mounted.container.querySelector<HTMLElement>(
    `.${String(styles.root)}`
  )!;
  return { app, root };
}

const VIEWER_SOURCE = readFileSync(
  join(
    process.cwd(),
    'src',
    'components',
    'erd',
    'diff-viewer',
    'erd-viewer',
    'ErdViewer.tsx'
  ),
  'utf8'
);

/** Every place the routing asks the event target for an ancestor of one class. */
const routingCalls = (className: string) =>
  VIEWER_SOURCE.match(
    new RegExp(String.raw`closest\(\s*'\.${className}'\s*\)`, 'g')
  ) ?? [];

/**
 * The overlays that stayed dom when the scene moved onto a canvas. The viewer
 * carries the same guard list the editor does, minus the ones only an editable
 * canvas can raise.
 */
const DOM_GUARDS = [
  'color-picker',
  'edit-overlay',
  'edit-input',
  'context-menu-content',
  'hide-sign',
  'minimap',
  'minimap-viewport',
  'virtual-scroll',
];

const mousedownAt = (target: Element) =>
  target.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 })
  );

function wheelAt(
  target: Element,
  { deltaX = 0, deltaY = 0, mod = false } = {}
) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaX,
    deltaY,
  });
  if (mod) {
    Object.defineProperty(event, 'ctrlKey', { value: true });
    Object.defineProperty(event, 'metaKey', { value: true });
  }
  target.dispatchEvent(event);
  return event;
}

describe('ErdViewer', () => {
  it('tags the root with the insert scope class for an insert viewer', async () => {
    const { root } = await mountViewer(Diff.insert);

    expect(root.classList.contains('diff-viewer-insert')).toBe(true);
    expect(root.classList.contains('diff-viewer-delete')).toBe(false);
    expect(root.style.cursor).toBe('grab');
  });

  it('tags the root with the delete scope class for any other diff', async () => {
    const { root } = await mountViewer(Diff.delete);

    expect(root.classList.contains('diff-viewer-delete')).toBe(true);
    expect(root.classList.contains('diff-viewer-insert')).toBe(false);
  });

  it('injects the generated diff stylesheet into the viewer', async () => {
    const { root } = await mountViewer(Diff.insert, diffMapOf());

    const style = root.querySelector('style');
    expect(style).toBeTruthy();
    expect(style?.textContent).toContain('.diff-viewer-insert [data-id="t1"]');
    expect(style?.textContent).toContain(
      'background-color: var(--diff-insert-background)'
    );
  });

  it('renders the canvas, the virtual scroll and the minimap', async () => {
    const { root } = await mountViewer(Diff.insert);

    expect(root.querySelector('.virtual-scroll')).toBeTruthy();
    expect(root.querySelector('.minimap')).toBeTruthy();
    expect(root.querySelector('[data-testid="erd-canvas"]')).toBeTruthy();
  });

  it('prevents the native context menu', async () => {
    const { root } = await mountViewer(Diff.insert);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    root.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('scrolls the store on a plain wheel and blocks the default', async () => {
    const { app, root } = await mountViewer(Diff.insert);

    const event = wheelAt(root, { deltaX: 40, deltaY: 100 });
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(app.store.state.settings.scrollTop).toBe(-100);
    expect(app.store.state.settings.scrollLeft).toBe(-40);
    expect(app.store.state.settings.zoomLevel).toBe(1);
  });

  it('zooms out instead of scrolling when the mod key is held', async () => {
    const { app, root } = await mountViewer(Diff.insert);

    wheelAt(root, { deltaY: 100, mod: true });
    await flush();

    // A plain wheel carrying no deltaX leaves scrollLeft alone; the zoom path
    // re-centres both axes, so the horizontal offset is what separates them.
    expect(app.store.state.settings.zoomLevel).toBeCloseTo(0.9, 5);
    expect(app.store.state.settings.scrollLeft).toBe(-50);
  });

  it('zooms in when the wheel scrolls up with the mod key', async () => {
    const app = createApp();
    const { root } = await mountViewer(Diff.insert, new Map(), app);

    wheelAt(root, { deltaY: 100, mod: true });
    await flush();
    wheelAt(root, { deltaY: -100, mod: true });
    await flush();

    expect(app.store.state.settings.zoomLevel).toBeCloseTo(1, 5);
  });

  it('unselects everything and closes the color picker on a bare mousedown', async () => {
    const app = createApp();
    app.store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    app.store.dispatchSync(
      addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    const { root } = await mountViewer(Diff.insert, new Map(), app);

    const emitted: string[] = [];
    app.emitter.on({
      closeColorPicker: () => emitted.push('closeColorPicker'),
    });

    mousedownAt(root);
    await flush();

    expect(emitted).toEqual(['closeColorPicker']);
    expect(Object.keys(app.store.state.editor.selectedMap)).toHaveLength(0);
    expect(root.style.cursor).toBe('grabbing');
  });

  it('asks no dom ancestor for a table or a memo', () => {
    expect(routingCalls('table')).toEqual([]);
    expect(routingCalls('memo')).toEqual([]);
  });

  it('keeps a dom guard for every overlay the scene never drew', () => {
    const guarded = DOM_GUARDS.filter(name => routingCalls(name).length > 0);

    expect(guarded).toEqual(DOM_GUARDS);
  });

  it('reads the scene half through the same hit test the editor uses', () => {
    expect(VIEWER_SOURCE).toMatch(/from '@\/components\/erd\/hitTest'/);
    expect(VIEWER_SOURCE).toContain('sceneHit(canvas.value, event)');
  });

  it('does not close the color picker when the press starts inside it', async () => {
    const app = createApp();
    const { root } = await mountViewer(Diff.insert, new Map(), app);

    const emitted: string[] = [];
    app.emitter.on({
      closeColorPicker: () => emitted.push('closeColorPicker'),
    });

    const picker = document.createElement('div');
    picker.classList.add('color-picker');
    root.append(picker);

    mousedownAt(picker);
    await flush();

    expect(emitted).toEqual([]);
    expect(root.style.cursor).toBe('grab');
  });

  it('ignores a mousedown with no target element', async () => {
    const app = createApp();
    const { root } = await mountViewer(Diff.insert, new Map(), app);

    const emitted: string[] = [];
    app.emitter.on({
      closeColorPicker: () => emitted.push('closeColorPicker'),
    });

    const event = new MouseEvent('mousedown', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    root.dispatchEvent(event);
    await flush();

    expect(emitted).toEqual([]);
    expect(root.style.cursor).toBe('grab');
  });

  it('scrolls while dragging and restores the grab cursor on release', async () => {
    const app = createApp();
    const { root } = await mountViewer(Diff.insert, new Map(), app);

    mousedownAt(root);
    await flush();
    expect(root.style.cursor).toBe('grabbing');

    window.dispatchEvent(
      new MouseEvent('mousemove', { clientX: -30, clientY: -50 })
    );
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(-30);
    expect(app.store.state.settings.scrollTop).toBe(-50);

    window.dispatchEvent(new MouseEvent('mouseup'));
    await flush();

    expect(root.style.cursor).toBe('grab');
  });

  it('ignores a drag move that did not move at all', async () => {
    const app = createApp();
    const { root } = await mountViewer(Diff.insert, new Map(), app);

    mousedownAt(root);
    await flush();

    window.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 0, clientY: 0 })
    );
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(0);
    expect(app.store.state.settings.scrollTop).toBe(0);
  });

  it('resets a scrolled root element while dragging', async () => {
    const app = createApp();
    const { root } = await mountViewer(Diff.insert, new Map(), app);

    root.scrollTop = 12;
    root.scrollLeft = 34;

    mousedownAt(root);
    await flush();
    window.dispatchEvent(
      new MouseEvent('mousemove', { clientX: -10, clientY: -10 })
    );
    await flush();

    expect(root.scrollTop).toBe(0);
    expect(root.scrollLeft).toBe(0);
  });

  it('prevents the default of a mousemove driven drag', async () => {
    const app = createApp();
    const { root } = await mountViewer(Diff.insert, new Map(), app);

    mousedownAt(root);
    await flush();

    const move = new MouseEvent('mousemove', {
      cancelable: true,
      clientX: -10,
      clientY: -10,
    });
    window.dispatchEvent(move);
    await flush();

    expect(move.defaultPrevented).toBe(true);
  });

  it('tears down its context provider and stops reacting after unmount', async () => {
    const app = createApp();
    const { root } = await mountViewer(Diff.insert, new Map(), app);
    expect(root.isConnected).toBe(true);

    mounted!.unmount();
    mounted = null;
    await flush();

    expect(root.isConnected).toBe(false);

    wheelAt(root, { deltaY: 100 });
    await flush();

    expect(app.store.state.settings.scrollTop).toBe(0);
  });
});
