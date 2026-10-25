// The overlay half of the press routing, driven by a real pointer. The dom
// editor sits beside the stage container, so the konva hit test cannot answer
// for it and only a class on an ancestor can.

import { toJson } from '@dineug/erd-editor-schema';
import { createRef, FC, observable, useProvider } from '@dineug/r-html';
import { whenDrawn } from '@dineug/r-html-konva';
import type { Group } from 'konva/lib/Group';
import type { Layer } from 'konva/lib/Layer';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  flush,
  mount,
  type Mounted,
  movePointer,
  releasePointer,
} from '@/__test-utils__';
import { type AppContext } from '@/components/appContext';
import Erd from '@/components/erd/Erd';
import {
  clearRelationshipHighlight,
  isRelationshipHighlighted,
  setRelationshipHighlight,
} from '@/components/erd/relationshipHighlight';
import { themeContext } from '@/components/themeContext';
import { Open } from '@/constants/open';
import { RelationshipType } from '@/constants/schema';
import {
  changeDrawTableGroupAction,
  changeHandToolAction,
  changeOpenMapAction,
  changeViewportAction,
  drawStartRelationshipAction,
  editMemoAction,
  editTableAction,
  focusTableAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { openColorPickerAction, openDiffViewerAction } from '@/utils/emitter';
import { CURSOR_GRABBING } from '@/utils/stageCursor';
import { TAKEOVERS } from '@/utils/takeover';

vi.mock(
  '@/components/erd/automatic-table-placement/createAutomaticTablePlacement',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/components/erd/automatic-table-placement/createAutomaticTablePlacement')
      >();

    return {
      ...actual,
      // Stopped at once: a preview that never settles is all a press needs, and
      // the d3 timer would otherwise apply the layout after the spec unmounted.
      createAutomaticTablePlacement: (
        ...args: Parameters<typeof actual.createAutomaticTablePlacement>
      ) => actual.createAutomaticTablePlacement(...args).stop(),
    };
  }
);

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

/** Mounts an Erd 800 by 600 under the test theme, seeds its store and waits for the first draw. */
async function mountErd(
  template: Parameters<typeof mount>[0],
  app: AppContext,
  seed: (store: AppContext['store']) => void
): Promise<Mounted> {
  const mounted = mount(template, app);
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

  app.store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
  seed(app.store);

  await flush();
  await whenDrawn();

  teardowns.push(() => {
    mounted.unmount();
    themeProvider.destroy();
  });

  return mounted;
}

/** An Erd with one memo, selected, with its editor open over the scene unless told otherwise. */
function mountEditingMemo({ editing = true } = {}): Promise<Mounted> {
  const app = createTestAppContext();
  return mountErd(
    <Erd isDarkMode={false} mouseTracking={false} readonly={false} />,
    app,
    store => {
      store.dispatchSync(
        addMemoAction({
          id: MEMO_ID,
          ui: { x: 80, y: 80, width: 240, height: 140, zIndex: 2 },
        })
      );
      store.dispatchSync(changeMemoValueAction({ id: MEMO_ID, value: BODY }));
      store.dispatchSync(selectAction({ [MEMO_ID]: SelectType.memo }));
      if (editing) store.dispatchSync(editMemoAction({ id: MEMO_ID }));
    }
  );
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

/** The lift of one button, dispatched where the pointer went up. */
const liftWith = (
  target: EventTarget,
  button: number,
  init: MouseEventInit = {}
) => {
  const event = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    composed: true,
    button,
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
    const lift = liftWith(rootOf(mounted), MIDDLE, {
      clientX: 430,
      clientY: 350,
    });
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

const openDiffViewer = ({ emitter, store }: AppContext) =>
  emitter.emit(openDiffViewerAction({ value: toJson(store.state) }));

const openTimeTravel = ({ store }: AppContext) =>
  store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));

const openPlacementPreview = ({ store }: AppContext) =>
  store.dispatchSync(
    changeOpenMapAction({ [Open.automaticTablePlacement]: true })
  );

/** The takeovers that stand a scene of their own over the canvas, each opened the way the editor opens it. */
const OPENED_TAKEOVERS: Array<[string, Open, (app: AppContext) => void]> = [
  ['the diff viewer', Open.diffViewer, openDiffViewer],
  ['time travel', Open.timeTravel, openTimeTravel],
  [
    'the automatic placement preview',
    Open.automaticTablePlacement,
    openPlacementPreview,
  ],
];

/** The chrome each takeover lays over its scene, which keeps its own presses. */
const TAKEOVER_CHROME: Array<[string, (app: AppContext) => void, string]> = [
  ['the diff tree', openDiffViewer, '.diff-viewer-tree'],
  ["a diff pane's minimap", openDiffViewer, '.diff-viewer-insert .minimap'],
  ['the time travel slider', openTimeTravel, '.time-travel-slider'],
];

/**
 * An Erd with a memo selected and a table to place, under one takeover, and
 * where a pointer over its scene lands: the nearest box above the takeover's
 * canvas shell that takes a pointer, a diff pane or the takeover's own root.
 */
async function mountTakeover(open: (app: AppContext) => void) {
  const mounted = await mountEditingMemo({ editing: false });
  const { store } = mounted.app;
  store.dispatchSync(
    addTableAction({ id: 'users', ui: { x: 400, y: 80, zIndex: 1 } })
  );
  open(mounted.app);
  await flush(6);
  await whenDrawn();

  const stages = rootOf(mounted).querySelectorAll('[data-testid="erd-canvas"]');
  const shell = stages[stages.length - 1].parentElement as HTMLElement;
  let target = shell.parentElement as HTMLElement;
  while (getComputedStyle(target).pointerEvents === 'none') {
    target = target.parentElement as HTMLElement;
  }
  const point = { clientX: 300, clientY: 240 };

  return { mounted, point, shell, target };
}

describe('Erd - a jump to a relationship lit', () => {
  it('goes out on a press that changes the selection and stays on through a middle pan (AC-N3)', async () => {
    const mounted = await mountEditingMemo({ editing: false });
    const editorId = mounted.app.store.state.editor.id;
    const canvas = canvasOf(mounted).querySelector('canvas')!;

    setRelationshipHighlight(editorId, 'rel');
    pressWith(canvas, MIDDLE);
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();
    expect(isRelationshipHighlighted(editorId, 'rel')).toBe(true);

    pressCanvas(mounted);
    await flush();
    expect(isRelationshipHighlighted(editorId, 'rel')).toBe(false);
  });

  it('stays on under the hand tool, whose press pans', async () => {
    const mounted = await mountEditingMemo({ editing: false });
    const { store } = mounted.app;
    const editorId = store.state.editor.id;
    store.dispatchSync(changeHandToolAction({ value: true }));
    await flush();

    setRelationshipHighlight(editorId, 'rel');
    pressCanvas(mounted);
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();

    expect(isRelationshipHighlighted(editorId, 'rel')).toBe(true);
    clearRelationshipHighlight(editorId);
  });
});

describe('Erd - a middle button press over a takeover', () => {
  it('runs every takeover the editor knows', () => {
    const keys = OPENED_TAKEOVERS.map(([, key]) => key);
    expect(new Set(keys)).toEqual(new Set(TAKEOVERS));
  });

  it.each(OPENED_TAKEOVERS)(
    'keeps the selection under %s, the press and its lift prevented',
    async (_, __, open) => {
      const { mounted, point, shell, target } = await mountTakeover(open);
      expect(shell.style.pointerEvents).toBe('none');
      expect(target.contains(canvasOf(mounted))).toBe(false);

      const press = pressWith(target, MIDDLE, point);
      movePointer(point.clientX - 40, point.clientY - 20);
      const lift = liftWith(target, MIDDLE);
      await flush();

      expect(press.defaultPrevented).toBe(true);
      expect(lift.defaultPrevented).toBe(true);
      expect(selectedIds(mounted)).toEqual([MEMO_ID]);
    }
  );

  it.each(TAKEOVER_CHROME)(
    'leaves %s its own presses: a middle one is unprevented and unselects, as a main one does',
    async (_, open, selector) => {
      const { mounted, point } = await mountTakeover(open);
      const chrome = rootOf(mounted).querySelector(selector) as HTMLElement;
      expect(chrome).toBeTruthy();

      const press = pressWith(chrome, MIDDLE, point);
      const lift = liftWith(chrome, MIDDLE);
      await flush();

      expect(press.defaultPrevented).toBe(false);
      expect(lift.defaultPrevented).toBe(false);
      expect(selectedIds(mounted)).toEqual([]);
    }
  );

  it('still takes the selection off on a main press there', async () => {
    const { mounted, point, target } = await mountTakeover(openTimeTravel);

    const press = pressWith(target, 0, point);
    releasePointer();
    await flush();

    expect(press.defaultPrevented).toBe(false);
    expect(selectedIds(mounted)).toEqual([]);
  });

  it('prevents no lift once the press has ended without one', async () => {
    const { point, target } = await mountTakeover(openTimeTravel);

    const press = pressWith(target, MIDDLE, point);
    expect(press.defaultPrevented).toBe(true);
    window.dispatchEvent(new FocusEvent('blur'));
    const lift = liftWith(window, MIDDLE);

    expect(lift.defaultPrevented).toBe(false);
  });
});

/** Whether the Erd a spec mounts is readonly, read by its prop and its store alike, as the element's two are. */
const readonlyHarness = observable({ readonly: false });

const ErdTurningReadonly: FC = () => () => (
  <Erd
    isDarkMode={false}
    mouseTracking={false}
    readonly={readonlyHarness.readonly}
  />
);

const TABLE_ID = 'users';

/** An Erd with one table, open to edits until the spec turns it readonly. */
function mountTurningReadonly(): Promise<Mounted> {
  readonlyHarness.readonly = false;
  const app = createTestAppContext({
    getReadonly: () => readonlyHarness.readonly,
  });
  return mountErd(<ErdTurningReadonly />, app, store =>
    store.dispatchSync(
      addTableAction({ id: TABLE_ID, ui: { x: 400, y: 80, zIndex: 1 } })
    )
  );
}

async function turnReadonly() {
  readonlyHarness.readonly = true;
  await flush();
  await whenDrawn();
}

const sceneStageOf = (): Stage => Reflect.get(globalThis, '__erdStages').canvas;

const tableBodyOf = () =>
  sceneStageOf().findOne<Group>(`#table-${TABLE_ID}`)!.findOne('.table-body')!;

/** The table as the drag layer holds it, which it does only while an entity drag runs. */
const heldTableOf = () =>
  sceneStageOf().findOne<Layer>('.drag-entity')?.findOne(`#table-${TABLE_ID}`);

const tableXOf = ({ app }: Mounted) =>
  app.store.state.collections.tableEntities[TABLE_ID].ui.x;

describe('Erd - a readonly editor under an Alt drag', () => {
  it('still draws the duplicate ghost, and its drop adds no table', async () => {
    const mounted = await mountTurningReadonly();
    await turnReadonly();

    fireScenePointer(tableBodyOf(), 'mousedown', {
      altKey: true,
      button: 0,
      clientX: 450,
      clientY: 100,
    });
    movePointer(520, 180);
    await flush();
    await whenDrawn();

    expect(sceneStageOf().find('.duplicate-ghost')).toHaveLength(1);

    releasePointer(520, 180);
    await flush();

    expect(mounted.app.store.state.doc.tableIds).toEqual([TABLE_ID]);
  });
});

describe('Erd - what an editor keeps once it turns readonly', () => {
  it('keeps the cell editor open and the table selected', async () => {
    const mounted = await mountTurningReadonly();
    const { store } = mounted.app;
    store.dispatchSync(
      selectAction({ [TABLE_ID]: SelectType.table }),
      focusTableAction({ tableId: TABLE_ID, focusType: FocusType.tableName }),
      editTableAction()
    );
    await flush();

    await turnReadonly();

    expect(store.state.editor.focusTable?.edit).toBe(true);
    expect(
      mounted.container.querySelector('.edit-overlay input.edit-input')
    ).toBeTruthy();
    expect(selectedIds(mounted)).toEqual([TABLE_ID]);
  });

  it('keeps a relationship draw armed', async () => {
    const mounted = await mountTurningReadonly();
    const { store } = mounted.app;
    store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN })
    );
    await flush();

    await turnReadonly();

    expect(store.state.editor.drawRelationship).not.toBeNull();
    expect(rootOf(mounted).style.cursor).toContain('url(');
  });

  it('keeps the hand tool up', async () => {
    const mounted = await mountTurningReadonly();
    const { store } = mounted.app;
    store.dispatchSync(changeHandToolAction({ value: true }));
    await flush();

    await turnReadonly();

    expect(store.state.editor.handTool).toBe(true);
    expect(rootOf(mounted).style.cursor).toBe('grab');
  });

  it('keeps an entity drag held, whose later steps move nothing', async () => {
    const mounted = await mountTurningReadonly();
    const startX = tableXOf(mounted);

    fireScenePointer(tableBodyOf(), 'mousedown', {
      button: 0,
      clientX: 450,
      clientY: 100,
    });
    movePointer(490, 100);
    await flush();
    expect(tableXOf(mounted)).toBe(startX + 40);

    await turnReadonly();
    movePointer(560, 100);
    await flush();
    await whenDrawn();

    expect(heldTableOf()).toBeTruthy();
    expect(tableXOf(mounted)).toBe(startX + 40);

    releasePointer(560, 100);
    await flush();
    await whenDrawn();
    expect(heldTableOf()).toBeFalsy();
  });

  it.each([
    ['time travel', Open.timeTravel, openTimeTravel],
    [
      'the automatic placement preview',
      Open.automaticTablePlacement,
      openPlacementPreview,
    ],
  ] as const)('keeps %s open over the canvas', async (_, key, open) => {
    const mounted = await mountTurningReadonly();
    open(mounted.app);
    await flush(6);
    await whenDrawn();

    await turnReadonly();

    expect(mounted.app.store.state.editor.openMap[key]).toBe(true);
    expect(
      rootOf(mounted).querySelectorAll('[data-testid="erd-canvas"]')
    ).toHaveLength(2);
  });

  it('ends a table group draw, the one draw it ends', async () => {
    const mounted = await mountTurningReadonly();
    const { store } = mounted.app;
    store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    await flush();

    await turnReadonly();

    expect(store.state.editor.drawTableGroup).toBe(false);
  });
});
