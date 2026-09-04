// The overlay half of the press routing, driven by a real pointer. The dom
// editor sits beside the stage container, so the konva hit test cannot answer
// for it and only a class on an ancestor can.

import { createRef, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import Erd from '@/components/erd/Erd';
import { themeContext } from '@/components/themeContext';
import {
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
  const mounted = mount(<Erd isDarkMode={false} mouseTracking={false} />, app);
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
