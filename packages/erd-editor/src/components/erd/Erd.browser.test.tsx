// The overlay half of the press routing, driven by a real pointer. The dom
// editor sits beside the stage container, so the konva hit test cannot answer
// for it and only a class on an ancestor can.

import { createRef, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
  movePointer,
  releasePointer,
} from '@/__test-utils__';
import Erd from '@/components/erd/Erd';
import { themeContext } from '@/components/themeContext';
import {
  changeHandToolAction,
  changeViewportAction,
  editMemoAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { openColorPickerAction } from '@/utils/emitter';
import { CURSOR_GRABBING } from '@/utils/stageCursor';

const MEMO_ID = 'note';

const BODY = 'the quick brown fox jumps over the lazy dog';

const teardowns: Array<() => void> = [];

afterEach(async () => {
  // Erd subscribes to the global drag$ on a canvas press and only a global
  // mouseup completes it, so an unfinished drag would outlive the mount.
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/** An Erd with one memo, selected, with its editor open over the scene. */
async function mountEditingMemo(): Promise<Mounted> {
  const app = createTestAppContext();
  const mounted = mount(
    <Erd isDarkMode={false} mouseTracking={false} readonly={false} />,
    app
  );
  mounted.container.setAttribute(
    'style',
    'width: 800px; height: 600px; position: relative;'
  );

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  const { store } = app;
  store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
  store.dispatchSync(
    addMemoAction({
      id: MEMO_ID,
      ui: { x: 80, y: 80, width: 240, height: 140, zIndex: 2 },
    })
  );
  store.dispatchSync(changeMemoValueAction({ id: MEMO_ID, value: BODY }));
  store.dispatchSync(selectAction({ [MEMO_ID]: SelectType.memo }));
  store.dispatchSync(editMemoAction({ id: MEMO_ID }));

  await flush();
  await whenDrawn();

  teardowns.push(() => {
    mounted.unmount();
    themeProvider.destroy();
  });

  return mounted;
}

const memoEditorOf = (mounted: Mounted) =>
  mounted.container.querySelector(
    '.edit-overlay textarea.memo-textarea'
  ) as HTMLTextAreaElement;

const canvasOf = (mounted: Mounted) =>
  mounted.container.querySelector(
    '[data-testid="erd-canvas"]'
  ) as HTMLDivElement;

const selectedIds = (mounted: Mounted) =>
  Object.keys(mounted.app.store.state.editor.selectedMap);

/** Standing in for the editor root a mounted Erd has no ancestor of here. */
const rootOf = (mounted: Mounted) =>
  mounted.container.firstElementChild as HTMLDivElement;

const pressCanvas = (mounted: Mounted) => {
  canvasOf(mounted).dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, clientX: 400, clientY: 300 })
  );
};

describe('Erd - a press inside the editor over the scene', () => {
  it('leaves the memo selected and its editor open', async () => {
    const mounted = await mountEditingMemo();
    const textarea = memoEditorOf(mounted);
    expect(textarea).toBeTruthy();

    await userEvent.click(textarea);
    await flush();

    expect(selectedIds(mounted)).toEqual([MEMO_ID]);
    expect(mounted.app.store.state.editor.editMemoId).toBe(MEMO_ID);
    expect(memoEditorOf(mounted)).toBeTruthy();
  });

  it('still unselects when the same pointer lands on bare canvas', async () => {
    const mounted = await mountEditingMemo();
    expect(selectedIds(mounted)).toEqual([MEMO_ID]);

    await userEvent.click(canvasOf(mounted));
    await flush();

    expect(selectedIds(mounted)).toEqual([]);
  });
});

describe('Erd - a canvas pan', () => {
  it('takes selection off the editor for the length of the drag', async () => {
    const mounted = await mountEditingMemo();
    const root = rootOf(mounted);

    pressCanvas(mounted);
    expect(root.style.userSelect).toBe('none');

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(root.style.userSelect).toBe('');
  });

  it('puts it back where a native drag ate the mouseup', async () => {
    const mounted = await mountEditingMemo();
    const root = rootOf(mounted);

    pressCanvas(mounted);
    window.dispatchEvent(new Event('dragstart'));

    expect(root.style.userSelect).toBe('');
  });
});

/** A press of one button, the way a mouse delivers it to whatever lies under the point. */
const pressWith = (
  target: Element,
  button: number,
  init: MouseEventInit = {}
) => {
  const event = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    button,
    clientX: 400,
    clientY: 300,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

const MIDDLE = 1;

describe('Erd - a middle button press', () => {
  it('closes the context menu and the colour picker, and keeps the selection', async () => {
    const mounted = await mountEditingMemo();
    const root = rootOf(mounted);
    root.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 600,
        clientY: 400,
      })
    );
    mounted.app.emitter.emit(
      openColorPickerAction({ x: 200, y: 200, color: '#ffffff' })
    );
    await flush(6);
    expect(root.querySelector('.context-menu-content')).toBeTruthy();
    expect(root.querySelector('.color-picker')).toBeTruthy();

    const press = pressWith(canvasOf(mounted).querySelector('canvas')!, MIDDLE);
    await flush(6);

    expect(press.defaultPrevented).toBe(true);
    expect(root.querySelector('.context-menu-content')).toBeNull();
    expect(root.querySelector('.color-picker')).toBeNull();
    expect(selectedIds(mounted)).toEqual([MEMO_ID]);
  });

  it('shows the grabbing hand over the scene until the release', async () => {
    const mounted = await mountEditingMemo();
    const container = canvasOf(mounted);

    pressWith(container.querySelector('canvas')!, MIDDLE);
    expect(container.style.cursor).toBe(CURSOR_GRABBING);

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(container.style.cursor).not.toBe(CURSOR_GRABBING);
  });

  it('leaves a press on the editor over the scene to the editor', async () => {
    const mounted = await mountEditingMemo();

    const press = pressWith(memoEditorOf(mounted), MIDDLE);
    await flush();

    expect(press.defaultPrevented).toBe(false);
    expect(mounted.app.store.state.editor.editMemoId).toBe(MEMO_ID);
    expect(selectedIds(mounted)).toEqual([MEMO_ID]);
  });

  /**
   * The hand tool takes the pointer off the stage container, so its root pans
   * for the press instead; the middle button still reads the same there.
   */
  it('pans under the hand tool too, press and lift prevented, keeping the selection, and draws no marquee for a held modifier', async () => {
    const mounted = await mountEditingMemo();
    const { store, emitter } = mounted.app;
    store.dispatchSync(changeHandToolAction({ value: true }));
    await flush();
    const dragSelectStart = vi.fn();
    emitter.on({ dragSelectStart });

    const press = pressWith(rootOf(mounted), MIDDLE, {
      ctrlKey: true,
      metaKey: true,
    });
    movePointer(430, 350);
    const lift = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      button: MIDDLE,
      clientX: 430,
      clientY: 350,
    });
    rootOf(mounted).dispatchEvent(lift);
    await flush();

    expect(press.defaultPrevented).toBe(true);
    expect(lift.defaultPrevented).toBe(true);
    expect(dragSelectStart).not.toHaveBeenCalled();
    expect(store.state.settings.originX).toBe(30);
    expect(store.state.settings.originY).toBe(50);
    expect(selectedIds(mounted)).toEqual([MEMO_ID]);
  });

  it('takes the selection off on a main press under the hand tool', async () => {
    const mounted = await mountEditingMemo();
    mounted.app.store.dispatchSync(changeHandToolAction({ value: true }));
    await flush();

    const press = pressWith(rootOf(mounted), 0);
    releasePointer();
    await flush();

    expect(press.defaultPrevented).toBe(false);
    expect(selectedIds(mounted)).toEqual([]);
  });
});
