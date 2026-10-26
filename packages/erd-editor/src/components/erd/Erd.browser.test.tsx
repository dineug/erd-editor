// The overlay half of the press routing, driven by a real pointer. The dom
// editor sits beside the stage container, so the konva hit test cannot answer
// for it and only a class on an ancestor can.

import { toJson } from '@dineug/erd-editor-schema';
import {
  type AnyAction,
  type CompositionActions,
  compositionActionsFlat,
  createRef,
  FC,
  observable,
  ref,
  useProvider,
} from '@dineug/r-html';
import { whenDrawn } from '@dineug/r-html-konva';
import type { Group } from 'konva/lib/Group';
import type { Layer } from 'konva/lib/Layer';
import { type Stage, stages } from 'konva/lib/Stage';
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
  moveScenePointer,
  releasePointer,
} from '@/__test-utils__';
import {
  type DiffSeed,
  diffStateOf,
  seedDiff,
} from '@/__test-utils__/diffSeed';
import { type AppContext, useAppContext } from '@/components/appContext';
import Erd from '@/components/erd/Erd';
import * as erdStyles from '@/components/erd/Erd.styles';
import {
  clearRelationshipHighlight,
  isRelationshipHighlighted,
  setRelationshipHighlight,
} from '@/components/erd/relationshipHighlight';
import type {
  ErdEditorElement,
  ErdEditorProps,
} from '@/components/erd-editor/ErdEditor';
import { useErdEditorAttachElement } from '@/components/erd-editor/useErdEditorAttachElement';
import ExplorerPanel from '@/components/explorer/explorer-panel/ExplorerPanel';
import { createScopeActions } from '@/components/quick-search/actions';
import QuickSearch from '@/components/quick-search/QuickSearch';
import * as quickSearchStyles from '@/components/quick-search/QuickSearch.styles';
import { themeContext } from '@/components/themeContext';
import { Open } from '@/constants/open';
import { RelationshipType, Show } from '@/constants/schema';
import {
  EDIT_OPEN_KEYS,
  EditStateOpenActionTypes,
  opensEditDialog,
  ReadonlyIgnoreActionTypes,
} from '@/engine/actions';
import { documentJsonOf } from '@/engine/documentJson';
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
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import {
  changeShowAction,
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { attachActionTag, Tag } from '@/engine/tag';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import {
  copyAction,
  openColorPickerAction,
  openDiffViewerAction,
  openTablePropertiesAction,
} from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { CURSOR_GRABBING } from '@/utils/stageCursor';
import {
  CLIPBOARD_MIME,
  type ClipboardPayload,
} from '@/utils/table-clipboard/payload';
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

/**
 * The element's props a spec turns, read by its store, its own hook and its
 * ERD tab alike, as the element's three read them.
 */
const elementFlags = observable<ErdEditorProps>(
  {
    readonly: false,
    systemDarkMode: false,
    enableThemeBuilder: false,
    enableLocalePicker: false,
    enableWelcomeScreen: false,
  },
  { shallow: true }
);

/**
 * The hook the element mounts, on a host of its own, so a turn of the flag
 * ends the store's edit state and gives the screen back as the element does.
 */
function useElementTurns(app: AppContext) {
  const host = document.createElement('div') as unknown as ErdEditorElement;
  const { destroySet } = useErdEditorAttachElement({
    props: elementFlags,
    ctx: host,
    app,
    root: createRef<HTMLDivElement>(),
  });
  teardowns.push(() => destroySet.forEach(destroy => destroy()));
}

const ErdTurningReadonly: FC = (_props, ctx) => {
  const app = useAppContext(ctx);
  useElementTurns(app.value);

  return () => (
    <Erd
      isDarkMode={false}
      mouseTracking={false}
      readonly={elementFlags.readonly}
    />
  );
};

const TABLE_ID = 'users';

/** An Erd with one table, open to edits until the spec turns it readonly. */
function mountTurningReadonly(): Promise<Mounted> {
  elementFlags.readonly = false;
  const app = createTestAppContext({
    getReadonly: () => elementFlags.readonly,
    readonlyEditState: true,
  });
  return mountErd(<ErdTurningReadonly />, app, store =>
    store.dispatchSync(
      addTableAction({ id: TABLE_ID, ui: { x: 400, y: 80, zIndex: 1 } })
    )
  );
}

/** Turns the element readonly, or writable again, and waits for what that turn draws. */
async function turnReadonly(readonly = true) {
  elementFlags.readonly = readonly;
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
  it('draws no duplicate ghost, and its drop adds no table and selects none', async () => {
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

    expect(sceneStageOf().find('.duplicate-ghost')).toHaveLength(0);

    releasePointer(520, 180);
    await flush();

    expect(mounted.app.store.state.doc.tableIds).toEqual([TABLE_ID]);
    expect(selectedIds(mounted)).toEqual([]);
  });
});

describe('Erd - what an editor lets go of once it turns readonly', () => {
  it('closes the cell editor and takes the selection and the focus off', async () => {
    const mounted = await mountTurningReadonly();
    const { store } = mounted.app;
    store.dispatchSync(
      selectAction({ [TABLE_ID]: SelectType.table }),
      focusTableAction({ tableId: TABLE_ID, focusType: FocusType.tableName }),
      editTableAction()
    );
    await flush();

    expect(
      mounted.container.querySelector('.edit-overlay input.edit-input')
    ).toBeTruthy();

    await turnReadonly();

    expect(mounted.container.querySelector('.edit-overlay')).toBeNull();
    expect(store.state.editor.focusTable).toBeNull();
    expect(selectedIds(mounted)).toEqual([]);
  });

  it('ends a relationship draw', async () => {
    const mounted = await mountTurningReadonly();
    const { store } = mounted.app;
    store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN })
    );
    await flush();
    expect(rootOf(mounted).style.cursor).toContain('url(');

    await turnReadonly();

    expect(store.state.editor.drawRelationship).toBeNull();
    expect(rootOf(mounted).style.cursor).toBe('');
  });

  it('puts the hand tool down, which no chord takes up and no bar offers until writable', async () => {
    const mounted = await mountTurningReadonly();
    const { shortcut$, store } = mounted.app;
    store.dispatchSync(changeHandToolAction({ value: true }));
    await flush();
    expect(rootOf(mounted).style.cursor).toBe('grab');

    await turnReadonly();

    expect(store.state.editor.handTool).toBe(false);
    expect(rootOf(mounted).style.cursor).toBe('');

    shortcut$.next({
      type: KeyBindingName.handTool,
      event: new KeyboardEvent('keydown'),
    });
    await flush();
    expect(store.state.editor.handTool).toBe(false);

    const hand = () =>
      rootOf(mounted).querySelector<HTMLElement>(
        '.floating-toolbar [title^="Hand"]'
      );
    expect(hand()).toBeNull();

    await turnReadonly(false);
    hand()!.click();
    await flush();
    expect(store.state.editor.handTool).toBe(true);
    expect(rootOf(mounted).style.cursor).toBe('grab');
  });

  it('ends an entity drag at its next step, which moves nothing', async () => {
    const mounted = await mountTurningReadonly();
    const startX = tableXOf(mounted);

    fireScenePointer(tableBodyOf(), 'mousedown', {
      button: 0,
      clientX: 450,
      clientY: 100,
    });
    movePointer(490, 100);
    await flush();
    await whenDrawn();
    expect(tableXOf(mounted)).toBe(startX + 40);
    expect(heldTableOf()).toBeTruthy();

    await turnReadonly();
    movePointer(560, 100);
    await flush();
    await whenDrawn();

    expect(heldTableOf()).toBeFalsy();
    expect(tableXOf(mounted)).toBe(startX + 40);

    releasePointer(560, 100);
    await flush();
    expect(tableXOf(mounted)).toBe(startX + 40);
  });

  it.each([
    ['time travel', Open.timeTravel, openTimeTravel],
    [
      'the automatic placement preview',
      Open.automaticTablePlacement,
      openPlacementPreview,
    ],
  ] as const)('closes %s over the canvas', async (_, key, open) => {
    const mounted = await mountTurningReadonly();
    open(mounted.app);
    await flush(6);
    await whenDrawn();
    expect(
      rootOf(mounted).querySelectorAll('[data-testid="erd-canvas"]')
    ).toHaveLength(2);

    await turnReadonly();

    expect(mounted.app.store.state.editor.openMap[key]).toBe(false);
    expect(
      rootOf(mounted).querySelectorAll('[data-testid="erd-canvas"]')
    ).toHaveLength(1);
  });

  it('closes time travel before its Apply can step the history', async () => {
    const mounted = await mountTurningReadonly();
    const { store } = mounted.app;
    const { cursor } = store.history;
    expect(cursor).toBeGreaterThan(-1);
    openTimeTravel(mounted.app);
    await flush(6);
    await whenDrawn();

    // The slider's left end is the document before its first entry.
    const slider = rootOf(mounted).querySelector(
      '.time-travel-slider > div'
    ) as HTMLElement;
    const { left, top, height } = slider.getBoundingClientRect();
    pressWith(slider, 0, { clientX: left, clientY: top + height / 2 });
    releasePointer();
    await flush(6);
    await whenDrawn();
    const [, preview] = rootOf(mounted).querySelectorAll(
      '[data-testid="erd-canvas"]'
    );
    const previewStage = stages.find(stage => stage.container() === preview)!;
    expect(previewStage.findOne(`#table-${TABLE_ID}`)).toBeUndefined();
    const apply = rootOf(mounted).querySelector(
      '.time-travel-slider button'
    ) as HTMLButtonElement;
    expect(apply).toBeTruthy();

    await turnReadonly();
    apply.click();
    await flush();

    expect(rootOf(mounted).querySelector('.time-travel-slider')).toBeNull();
    expect(store.state.editor.openMap[Open.timeTravel]).toBe(false);
    expect(store.history.cursor).toBe(cursor);
    expect(store.state.doc.tableIds).toEqual([TABLE_ID]);
  });

  it('closes Map Columns', async () => {
    const mounted = await mountTurningReadonly();
    const { store } = mounted.app;
    store.dispatchSync(changeOpenMapAction({ [Open.mapColumns]: true }));

    await turnReadonly();

    expect(store.state.editor.openMap[Open.mapColumns]).toBe(false);
  });

  it('keeps Table Properties open, read only, and the diff viewer open', async () => {
    const mounted = await mountTurningReadonly();
    const { emitter, store } = mounted.app;
    emitter.emit(openTablePropertiesAction({ tableId: TABLE_ID }));
    store.dispatchSync(changeOpenMapAction({ [Open.tableProperties]: true }));
    await flush(6);
    const properties = () =>
      rootOf(mounted).querySelector<HTMLElement>('.table-properties');
    expect(properties()?.textContent).not.toContain('Read only');

    await turnReadonly();

    expect(store.state.editor.openMap[Open.tableProperties]).toBe(true);
    expect(properties()?.textContent).toContain('Read only');

    store.dispatchSync(changeOpenMapAction({ [Open.tableProperties]: false }));
    openDiffViewer(mounted.app);
    await turnReadonly(false);
    await turnReadonly();

    expect(store.state.editor.openMap[Open.diffViewer]).toBe(true);
    expect(rootOf(mounted).querySelector('.diff-viewer-tree')).toBeTruthy();
  });

  it('closes the colour picker, which opens again only once writable', async () => {
    const mounted = await mountTurningReadonly();
    const { emitter } = mounted.app;
    const picker = () => rootOf(mounted).querySelector('.color-picker');
    const openPicker = async () => {
      emitter.emit(openColorPickerAction({ x: 200, y: 200, color: '#ffffff' }));
      await flush(6);
    };
    await openPicker();
    expect(picker()).toBeTruthy();

    await turnReadonly();
    expect(picker()).toBeNull();
    await openPicker();
    expect(picker()).toBeNull();

    await turnReadonly(false);
    await openPicker();
    expect(picker()).toBeTruthy();
  });

  it('ends a table group draw', async () => {
    const mounted = await mountTurningReadonly();
    const { store } = mounted.app;
    store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    await flush();

    await turnReadonly();

    expect(store.state.editor.drawTableGroup).toBe(false);
  });
});

/** The modifier $mod resolves to, read off the platform the way hasAppleDevice reads it. */
const APPLE = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** A document a reader reads: two tables joined by a relationship, a memo and a group. */
const READ_SEED: DiffSeed = {
  tables: [
    {
      id: 'users',
      name: 'users',
      x: 20,
      y: 40,
      columns: [{ id: 'users.id', name: 'id', pk: true }],
    },
    {
      id: 'orders',
      name: 'orders',
      x: 420,
      y: 40,
      columns: [{ id: 'orders.user', name: 'user_id' }],
    },
  ],
  relationships: [
    {
      id: 'fk',
      parent: ['users', ['users.id']],
      child: ['orders', ['orders.user']],
    },
  ],
  memos: [{ id: 'memo', value: 'read me', x: 40, y: 300 }],
  groups: [
    { id: 'group', name: 'Billing', x: 420, y: 320, width: 300, height: 200 },
  ],
};

/**
 * What a press may not send under readonly: a cell focused, an entity
 * selected or raised, an editor opened, a draw begun or the document edited.
 * The unselect a still press sends takes what a jump left, so it is no edit.
 */
const READ_EDITS = new Set<string>([
  'editor.focusTable',
  'editor.focusColumn',
  'editor.select',
  'editor.selectAll',
  'editor.selectAllColumn',
  'table.changeZIndex',
  'memo.changeZIndex',
  'tableGroup.changeZIndex',
  ...EditStateOpenActionTypes,
  ...ReadonlyIgnoreActionTypes,
]);

const isReadEdit = (action: AnyAction) =>
  READ_EDITS.has(action.type) || opensEditDialog(action);

type Reader = {
  app: AppContext;
  /** The editor root that takes the keyboard, as the element's does. */
  shell: HTMLDivElement;
  container: HTMLDivElement;
  stage: Stage;
  /** Every action the scene dispatched, as it was sent and before the readonly filter. */
  sent: AnyAction[];
};

/** The element's keyboard root, its own hook, its Explorer tree and its palette, around the ERD tab. */
const ReaderShell: FC<{ readonly: boolean }> = (props, ctx) => {
  const app = useAppContext(ctx);
  const keys = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, keys);
  useElementTurns(app.value);

  const handleKeydown = (event: KeyboardEvent) => {
    app.value.keydown$.next(event);
  };

  return () => (
    <div
      class="root"
      use:ref={ref(keys)}
      tabindex="-1"
      style={{ display: 'flex', width: '1040px', height: '600px' }}
      on:keydown={handleKeydown}
    >
      <ExplorerPanel width={240} readonly={props.readonly} />
      <div style={{ position: 'relative', width: '800px', height: '600px' }}>
        <Erd
          isDarkMode={false}
          mouseTracking={false}
          readonly={props.readonly}
        />
      </div>
      <QuickSearch topLevel={createScopeActions} readonly={props.readonly} />
    </div>
  );
};

/**
 * The app the scene is handed, whose dispatches are recorded as they are sent,
 * the generators among them flattened as the store flattens them, so a press
 * is caught asking for what the readonly filter would then drop.
 */
function recordDispatches(base: AppContext): {
  app: AppContext;
  sent: AnyAction[];
} {
  const sent: AnyAction[] = [];
  const { store } = base;
  const dispatchSync = (...composition: CompositionActions) => {
    const actions = compositionActionsFlat(
      store.state,
      store.context,
      composition
    );
    sent.push(...actions);
    store.dispatchSync(actions);
  };
  const dispatch = (...composition: CompositionActions) => {
    queueMicrotask(() => dispatchSync(...composition));
  };

  return {
    app: { ...base, store: { ...store, dispatch, dispatchSync } },
    sent,
  };
}

const ReaderRoot: FC = () => () => (
  <ReaderShell readonly={elementFlags.readonly} />
);

/**
 * An editor store as the element builds it, the seed written before it turns
 * readonly, mounted readonly unless told otherwise, drawn and hit-tested.
 */
async function mountReader({ readonly = true } = {}): Promise<Reader> {
  elementFlags.readonly = false;
  const base = createTestAppContext({
    getReadonly: () => elementFlags.readonly,
    readonlyEditState: true,
  });
  base.store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
  seedDiff(base, READ_SEED);
  base.store.flushStreamBuffers();
  elementFlags.readonly = readonly;

  const { app, sent } = recordDispatches(base);
  const mounted = mount(<ReaderRoot />, app);
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );
  teardowns.push(() => {
    mounted.unmount();
    themeProvider.destroy();
  });
  await settleScene();

  const canvas = canvasOf(mounted);
  const stage = stages.find(candidate => candidate.container() === canvas)!;
  const shell = mounted.container.querySelector<HTMLDivElement>('.root')!;
  sent.length = 0;

  return { app, shell, container: mounted.container, stage, sent };
}

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** Drawn and settled, the hit canvas included, which lands a frame after the draw. */
async function settleScene(rounds = 3) {
  for (let round = 0; round < rounds; round++) {
    await flush();
    await whenDrawn();
    await nextFrame();
  }
}

type Point = { x: number; y: number };

/** A native pointer event at a point of the stage, on the canvas konva draws into. */
function pointerAt(
  stage: Stage,
  type: string,
  { x, y }: Point,
  init: MouseEventInit = {}
): MouseEvent {
  const content = stage.content.getBoundingClientRect();
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    clientX: content.left + x,
    clientY: content.top + y,
    ...init,
  });
  stage.content.querySelector('canvas')!.dispatchEvent(event);
  return event;
}

/** A press and its lift where it stood, the click konva makes of them included. */
async function clickAt(stage: Stage, point: Point, init: MouseEventInit = {}) {
  pointerAt(stage, 'mousedown', point, init);
  pointerAt(stage, 'mouseup', point, init);
  releasePointer();
  await settleScene();
}

/** Two clicks inside konva's window, the second carrying the browser's count of two. */
async function doubleClickAt(stage: Stage, point: Point) {
  for (const detail of [1, 2]) {
    pointerAt(stage, 'mousedown', point, { detail });
    pointerAt(stage, 'mouseup', point, { detail });
    releasePointer();
  }
  await settleScene();
}

/** A press carried from a point by a travel, in steps, and its lift. */
async function dragFrom(
  stage: Stage,
  from: Point,
  by: Point,
  init: MouseEventInit = {}
) {
  const down = pointerAt(stage, 'mousedown', from, init);
  for (let step = 1; step <= 4; step++) {
    movePointer(
      down.clientX + (by.x * step) / 4,
      down.clientY + (by.y * step) / 4
    );
    await flush();
  }
  releasePointer(down.clientX + by.x, down.clientY + by.y);
  await settleScene();
}

/** The menu a right press raises at a point, as the browser sends it after the press. */
async function rightClickAt(stage: Stage, point: Point) {
  pointerAt(stage, 'mousedown', point, { button: 2 });
  const menu = pointerAt(stage, 'contextmenu', point, { button: 2 });
  releasePointer();
  await settleScene();
  return menu;
}

function chordOn(
  root: HTMLElement,
  key: string,
  code: string,
  { mod = false, alt = false } = {}
) {
  const event = new KeyboardEvent('keydown', {
    key,
    code,
    altKey: alt,
    ctrlKey: mod && !APPLE,
    metaKey: mod && APPLE,
    bubbles: true,
    cancelable: true,
  });
  root.dispatchEvent(event);
  return event;
}

/** The pointer moved onto a point of the stage, which konva tells the shapes there of. */
const hoverAt = (stage: Stage, { x, y }: Point) =>
  moveScenePointer(stage, x, y);

const middleOfNode = (node: { getClientRect(): Record<string, number> }) => {
  const rect = node.getClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};

const nodeCenter = (stage: Stage, selector: string) =>
  middleOfNode(stage.findOne(selector)!);

const headerCellOf = (stage: Stage, tableId: string) =>
  middleOfNode(
    stage.findOne<Group>(`#table-${tableId}`)!.findOne('.tableName')!
  );

const columnCellOf = (stage: Stage, columnId: string) =>
  middleOfNode(
    stage.findOne<Group>(`#column-${columnId}`)!.findOne('.columnName')!
  );

/** A point of the stage no shape is hit at, which a press reads as bare canvas. */
function bareOf(stage: Stage): Point {
  for (let y = 20; y < stage.height(); y += 40) {
    for (let x = stage.width() - 20; x > 0; x -= 40) {
      if (!stage.getIntersection({ x, y })) return { x, y };
    }
  }
  throw new Error('the stage holds no bare point');
}

/** A touch on the canvas carrying the points given, which konva and the root both read. */
function touchAt(stage: Stage, type: string, points: Point[]) {
  const content = stage.content.getBoundingClientRect();
  const target = stage.content.querySelector('canvas')!;
  const touches = points.map(
    ({ x, y }, index) =>
      new Touch({
        identifier: index + 1,
        target,
        clientX: content.left + x,
        clientY: content.top + y,
      })
  );
  target.dispatchEvent(
    new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      touches: type === 'touchend' ? [] : touches,
      changedTouches: touches,
    })
  );
}

/** The fingers moved to the points given, heard on the window as a browser sends them there. */
function fingersTo(stage: Stage, points: Point[]) {
  const content = stage.content.getBoundingClientRect();
  const target = stage.content.querySelector('canvas')!;
  window.dispatchEvent(
    new TouchEvent('touchmove', {
      bubbles: true,
      cancelable: true,
      touches: points.map(
        ({ x, y }, index) =>
          new Touch({
            identifier: index + 1,
            target,
            clientX: content.left + x,
            clientY: content.top + y,
          })
      ),
    })
  );
}

/** The ERD tab's own root, whose cursor shows a pan. */
const erdRootOf = ({ container }: Reader) =>
  container.querySelector<HTMLDivElement>(`.${String(erdStyles.root)}`)!;

/** Opens the palette on the keyboard root, searches it and takes its first row, as a reader jumps. */
async function jumpThroughPalette({ container, shell }: Reader, query: string) {
  shell.focus();
  chordOn(shell, 'k', 'KeyK', { mod: true });
  await settleScene();

  const input = container.querySelector<HTMLInputElement>(
    '.quick-search input'
  )!;
  input.value = query;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await settleScene();
  container
    .querySelector('.quick-search-row')!
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await settleScene();
}

/** Opens the palette on the keyboard root with nothing typed, as a reader asks for its commands. */
async function openPalette({ shell }: Reader) {
  shell.focus();
  chordOn(shell, 'k', 'KeyK', { mod: true });
  await settleScene();
}

/** The names of the rows an open palette draws, top to bottom, each less its keywords and chord. */
const paletteRowsOf = ({ container }: Reader) =>
  Array.from(
    container.querySelectorAll(
      `.quick-search-row .${String(quickSearchStyles.name)}`
    ),
    row => (row.textContent ?? '').trim()
  );

/** Picks the row of an open palette by its name, as a reader clicks it. */
async function pickPaletteRow(reader: Reader, name: string) {
  const rows = reader.container.querySelectorAll('.quick-search-row');
  rows[paletteRowsOf(reader).indexOf(name)].dispatchEvent(
    new MouseEvent('click', { bubbles: true })
  );
  await settleScene();
}

/** The cell a jump to the orders table's foreign key column leaves focused. */
const FOCUSED_COLUMN = { tableId: 'orders', columnId: 'orders.user' };

const editsOf = ({ sent }: Reader) =>
  sent.filter(isReadEdit).map(({ type }) => type);

/** What a readonly editor never holds: an editor open, a draw armed, an edit dialog. */
function expectNoEditState({ app }: Reader) {
  const { editor } = app.store.state;
  expect(editor.focusTable?.edit ?? false).toBe(false);
  expect(editor.editMemoId).toBeNull();
  expect(editor.editTableGroupId).toBeNull();
  expect(editor.drawRelationship).toBeNull();
  expect(EDIT_OPEN_KEYS.filter(key => editor.openMap[key])).toEqual([]);
}

/** The floating toolbar's controls left to right, each by its title less its chord. */
const toolbarOf = (container: HTMLElement) =>
  Array.from(
    container.querySelector('.floating-toolbar')?.children ?? [],
    child => child.getAttribute('title')?.replace(/ \(.*\)$/, '')
  ).filter(Boolean);

/** What a readonly editor's floating toolbar keeps while its content is on the screen. */
const READ_TOOLBAR = [
  'Zoom out',
  'Reset zoom',
  'Zoom in',
  'Name View',
  'Zen Mode',
];

/** What a writable editor's floating toolbar holds over the same screen. */
const EDIT_TOOLBAR = [
  'Hand',
  'Select',
  'New Table',
  'New Memo',
  'New Table Group',
  'Zoom out',
  'Reset zoom',
  'Zoom in',
  'Zero One',
  'Zero N',
  'One Only',
  'One N',
  'Name View',
  'Zen Mode',
];

/** What a readonly editor's palette lists on the ERD tab with nothing typed: the rows that edit nothing. */
const READ_PALETTE = [
  'Tab',
  'Name View',
  'Database',
  'Export',
  'Toggle Explorer',
];

/** What a writable editor's palette lists over the same document, every row drawn at once. */
const EDIT_PALETTE = [
  'Tab',
  'Name View',
  'Derive Physical Names Again',
  'Database',
  'Import',
  'Import and Add',
  'Export',
  'New Table',
  'New Memo',
  'New Table Group',
  'Zero One',
  'Zero N',
  'One Only',
  'One N',
  'Auto Layout',
  'Toggle Explorer',
];

/** The rows of the menu a right press raised, top to bottom, each by its name less its chord. */
const menuRowsOf = (container: HTMLElement) =>
  Array.from(
    container.querySelector('.context-menu-content[data-id="root"]')
      ?.children ?? [],
    row => {
      const chord = row.querySelector('.kbd')?.textContent ?? '';
      return (row.textContent ?? '').replace(chord, '').trim();
    }
  );

/** What a readonly editor's canvas menu keeps, the rows that change nothing in the document. */
const READ_CANVAS_MENU = ['View Option', 'Name View', 'Export', 'Diff Viewer'];

/** What a writable editor's canvas menu holds over the same document. */
const EDIT_CANVAS_MENU = [
  'New Table',
  'New Memo',
  'New Table Group',
  'Toggle Explorer',
  'Relationship',
  'View Option',
  'Name View',
  'Derive Physical Names Again',
  'Database',
  'Import',
  'Import and Add',
  'Export',
  'Auto Layout',
  'Diff Viewer',
];

const originOf = ({ app }: Reader) => {
  const { originX, originY } = app.store.state.settings;
  return { originX, originY };
};

const tablePointOf = ({ app }: Reader, id: string) => {
  const { x, y } = app.store.state.collections.tableEntities[id].ui;
  return { x, y };
};

describe('Erd - a readonly editor reads its scene', () => {
  it('sends no edit for a press on a table, a column, a memo or a group, nor for a double click', async () => {
    const reader = await mountReader();
    const { stage } = reader;

    await clickAt(stage, headerCellOf(stage, 'users'));
    await clickAt(stage, columnCellOf(stage, 'users.id'));
    await clickAt(stage, nodeCenter(stage, '.memo-textarea'));
    await clickAt(stage, nodeCenter(stage, '.table-group-title-bar'));
    await clickAt(stage, nodeCenter(stage, '.table-group-body'));
    await doubleClickAt(stage, headerCellOf(stage, 'orders'));
    await doubleClickAt(stage, columnCellOf(stage, 'orders.user'));
    await doubleClickAt(stage, nodeCenter(stage, '.table-group-title-bar'));

    expect(editsOf(reader)).toEqual([]);
    expectNoEditState(reader);
    expect(reader.app.store.state.editor.selectedMap).toEqual({});
    expect(reader.app.store.state.editor.focusTable).toBeNull();
    expect(stage.find('.cell-focus-border')).toHaveLength(0);
    expect(reader.container.querySelector('.edit-overlay')).toBeNull();
  });

  it('opens no cell editor for Enter or Tab on the cell a palette jump focused', async () => {
    const reader = await mountReader();
    const { app, shell } = reader;
    await jumpThroughPalette(reader, '@user_id');
    expect(app.store.state.editor.openMap[Open.search]).toBeFalsy();
    expect(app.store.state.editor.focusTable).toMatchObject(FOCUSED_COLUMN);
    reader.sent.length = 0;

    chordOn(shell, 'Enter', 'Enter');
    await settleScene();
    expectNoEditState(reader);

    chordOn(shell, 'Tab', 'Tab');
    await settleScene();
    expectNoEditState(reader);
    expect(app.store.state.editor.focusTable).toMatchObject(FOCUSED_COLUMN);
    expect(editsOf(reader)).toEqual([]);
  });

  it('raises the table menu for a right press on a table alone, Table Properties its one row, selecting nothing for any', async () => {
    const reader = await mountReader();
    const { stage, container } = reader;
    const menu = () => container.querySelector('.context-menu-content');

    for (const selector of [
      '.relationship-hit-area',
      '.memo-textarea',
      '.table-group-title-bar',
      '.table-group-body',
    ]) {
      const event = await rightClickAt(stage, nodeCenter(stage, selector));
      expect(event.defaultPrevented).toBe(true);
      expect(menu()).toBeNull();
    }

    await rightClickAt(stage, columnCellOf(stage, 'users.id'));
    expect(menu()).toBeTruthy();
    expect(menuRowsOf(container)).toEqual(['Table Properties']);
    expect(editsOf(reader)).toEqual([]);
    expect(reader.app.store.state.editor.selectedMap).toEqual({});
  });

  it('keeps View Option, Name View, Export and Diff Viewer alone in the canvas menu', async () => {
    const reader = await mountReader();
    const { stage, container } = reader;

    await rightClickAt(stage, bareOf(stage));

    expect(menuRowsOf(container)).toEqual(READ_CANVAS_MENU);
    expect(editsOf(reader)).toEqual([]);
  });

  it('lists in the palette the tabs, the name view, the database, Export and the Explorer, and no row that edits', async () => {
    const reader = await mountReader();

    await openPalette(reader);

    expect(paletteRowsOf(reader)).toEqual(READ_PALETTE);
    expect(editsOf(reader)).toEqual([]);
  });

  it('draws no control that edits, on a scene mounted readonly, a focused row’s drag handle among them', async () => {
    const reader = await mountReader();
    const { stage } = reader;
    await jumpThroughPalette(reader, '@user_id');
    expect(reader.app.store.state.editor.focusTable).toMatchObject(
      FOCUSED_COLUMN
    );
    hoverAt(stage, headerCellOf(stage, 'users'));
    await settleScene();

    expectNoEditControls(reader);
  });

  it('takes the controls that edit off the nodes already drawn as it turns readonly', async () => {
    const reader = await mountReader({ readonly: false });
    const { stage } = reader;
    await jumpThroughPalette(reader, '@user_id');
    hoverAt(stage, headerCellOf(stage, 'users'));
    await settleScene();
    const table = stage.findOne('#table-users');
    const countOf = (name: string) => stage.find(name).length;
    expect(countOf('.table-add-column')).toBe(2);
    expect(countOf('.memo-remove')).toBe(1);
    expect(countOf('.table-group-remove')).toBe(1);
    expect(countOf('.table-group-sash')).toBeGreaterThan(0);
    expect(countOf('.column-drag-handle')).toBe(1);
    expect(reader.container.querySelector('.edit-overlay')).toBeTruthy();

    elementFlags.readonly = true;
    await settleScene();

    // The turn ends the focus the jump left, and the handle beside it.
    expect(reader.app.store.state.editor.focusTable).toBeNull();
    expectNoEditControls(reader);
    expect(stage.findOne('#table-users') === table).toBe(true);
  });

  it('keeps the zoom, the name view, zen mode and the compass in the floating toolbar, and no tool, add or notation', async () => {
    const reader = await mountReader();
    const { app, container } = reader;
    expect(toolbarOf(container)).toEqual(READ_TOOLBAR);

    app.store.dispatchSync(
      scrollToAction({ originX: -5_000, originY: -4_000 })
    );
    await settleScene();
    expect(toolbarOf(container)).toEqual([...READ_TOOLBAR, 'Go to content']);

    const zoomLevel = app.store.state.settings.zoomLevel;
    container
      .querySelector<HTMLElement>('.floating-toolbar [title^="Zoom in"]')!
      .click();
    await settleScene();
    expect(app.store.state.settings.zoomLevel).toBeGreaterThan(zoomLevel);
    expect(editsOf(reader)).toEqual([]);
  });

  it('pans a drag that starts on a table, which stays where it stands', async () => {
    const reader = await mountReader();
    const before = originOf(reader);
    const users = tablePointOf(reader, 'users');

    await dragFrom(reader.stage, headerCellOf(reader.stage, 'users'), {
      x: 60,
      y: 30,
    });

    expect(originOf(reader)).toEqual({
      originX: before.originX + 60,
      originY: before.originY + 30,
    });
    expect(tablePointOf(reader, 'users')).toEqual(users);
    expect(editsOf(reader)).toEqual([]);
    expect(reader.app.store.state.editor.selectedMap).toEqual({});
  });

  it('pans a finger dragged before the editor holds the focus, its root holding every touch', async () => {
    const reader = await mountReader();
    const { shell, stage } = reader;
    const start = headerCellOf(stage, 'users');
    const moved = { x: start.x + 80, y: start.y + 20 };
    const before = originOf(reader);
    const users = tablePointOf(reader, 'users');
    expect(shell.matches(':focus-within')).toBe(false);

    touchAt(stage, 'touchstart', [start]);
    fingersTo(stage, [moved]);
    touchAt(stage, 'touchend', [moved]);
    await settleScene();

    expect(originOf(reader)).toEqual({
      originX: before.originX + 80,
      originY: before.originY + 20,
    });
    expect(tablePointOf(reader, 'users')).toEqual(users);
    expect(editsOf(reader)).toEqual([]);
  });

  it('zooms for a second finger, which ends the first one’s pan and leaves no still press to light', async () => {
    const reader = await mountReader();
    const { app, stage } = reader;
    const editorId = app.store.state.editor.id;
    const users = headerCellOf(stage, 'users');
    const beside = { x: users.x + 120, y: users.y };

    touchAt(stage, 'touchstart', [users]);
    touchAt(stage, 'touchstart', [users, beside]);
    touchAt(stage, 'touchend', [users]);
    await settleScene();
    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(false);

    const panned = { x: users.x + 40, y: users.y };
    const zoom = app.store.state.settings.zoomLevel;
    touchAt(stage, 'touchstart', [users]);
    fingersTo(stage, [panned]);
    await settleScene();
    expect(erdRootOf(reader).style.cursor).toBe('grabbing');

    touchAt(stage, 'touchstart', [panned, beside]);
    await settleScene();
    expect(erdRootOf(reader).style.cursor).toBe('');

    fingersTo(stage, [
      { x: panned.x - 40, y: panned.y },
      { x: beside.x + 40, y: beside.y },
    ]);
    touchAt(stage, 'touchend', [panned]);
    await settleScene();

    expect(app.store.state.settings.zoomLevel).toBeGreaterThan(zoom);
    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(false);
    expect(app.store.state.editor.selectedMap).toEqual({});
    expect(editsOf(reader)).toEqual([]);
  });

  it('lights a table’s relationships for a still click on it and puts them out for one on bare canvas', async () => {
    const reader = await mountReader();
    const { stage, app } = reader;
    const editorId = app.store.state.editor.id;

    await clickAt(stage, headerCellOf(stage, 'users'));
    hoverAt(stage, bareOf(stage));
    await settleScene();
    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(true);

    await clickAt(stage, bareOf(stage));
    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(false);

    hoverAt(stage, headerCellOf(stage, 'orders'));
    await settleScene();
    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(true);
    hoverAt(stage, bareOf(stage));
    await settleScene();
    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(false);
  });

  it('puts out the light a still click left once a document is loaded in place of the one it lit', async () => {
    const reader = await mountReader();
    const { stage, app } = reader;
    const editorId = app.store.state.editor.id;
    await clickAt(stage, headerCellOf(stage, 'users'));
    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(true);

    app.store.dispatchSync(
      initialLoadJsonAction$(toJson(diffStateOf(READ_SEED)))
    );
    await settleScene();

    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(false);
  });

  it('keeps the outline an Explorer row leaves, copies its table, and the next still click takes it', async () => {
    const reader = await mountReader();
    const { app, container, stage } = reader;
    const row = Array.from(
      container.querySelectorAll<HTMLElement>('[role="treeitem"]')
    ).find(item => item.id.endsWith(':t:users'))!;

    row.click();
    await settleScene();
    expect(app.store.state.editor.selectedMap).toEqual({
      users: SelectType.table,
    });
    expectNoEditState(reader);

    const setData = vi.fn();
    app.emitter.emit(
      copyAction({
        event: {
          preventDefault: vi.fn(),
          target: null,
          clipboardData: { setData, clearData: vi.fn(), getData: () => '' },
        } as unknown as ClipboardEvent,
      })
    );
    await flush();
    const [, payload] = setData.mock.calls.find(
      ([type]) => type === CLIPBOARD_MIME
    )!;
    const { tables } = JSON.parse(payload) as ClipboardPayload;
    expect(tables.map(({ sourceId }) => sourceId)).toEqual(['users']);

    await clickAt(stage, bareOf(stage));
    expect(app.store.state.editor.selectedMap).toEqual({});
  });

  it('keeps the outline a palette # row leaves until the next still click', async () => {
    const reader = await mountReader();
    const { app, stage } = reader;
    await jumpThroughPalette(reader, '#orders');

    expect(app.store.state.editor.selectedMap).toEqual({
      orders: SelectType.table,
    });
    expectNoEditState(reader);

    await clickAt(stage, bareOf(stage));
    expect(app.store.state.editor.selectedMap).toEqual({});
  });

  it('opens Table Properties, read only, for its chord on the table a palette # row or an Explorer row selected', async () => {
    const reader = await mountReader();
    const { app, container, shell } = reader;
    const opened = vi.fn();
    app.emitter.on({ openTableProperties: opened });
    const tablePropertiesChord = async () => {
      shell.focus();
      chordOn(shell, ' ', 'Space', { alt: true });
      await settleScene();
    };

    await jumpThroughPalette(reader, '#orders');
    await tablePropertiesChord();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened.mock.calls[0][0].payload).toEqual({ tableId: 'orders' });
    expect(container.querySelector('.table-properties')?.textContent).toContain(
      'Read only'
    );

    Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]'))
      .find(item => item.id.endsWith(':t:users'))!
      .click();
    await settleScene();
    expect(container.querySelector('.table-properties')).toBeNull();
    await tablePropertiesChord();
    expect(opened).toHaveBeenCalledTimes(2);
    expect(opened.mock.calls[1][0].payload).toEqual({ tableId: 'users' });
    expect(container.querySelector('.table-properties')).not.toBeNull();
    expectNoEditState(reader);
  });

  it('selects nothing for the select all chord or a modifier drag, which pans and draws no marquee', async () => {
    const reader = await mountReader();
    const { app, shell, stage } = reader;
    const dragSelectStart = vi.fn();
    app.emitter.on({ dragSelectStart });

    chordOn(shell, 'a', 'KeyA', { mod: true });
    await settleScene();
    expect(app.store.state.editor.selectedMap).toEqual({});

    const before = originOf(reader);
    await dragFrom(
      stage,
      bareOf(stage),
      { x: -200, y: 150 },
      { ctrlKey: !APPLE, metaKey: APPLE }
    );

    expect(dragSelectStart).not.toHaveBeenCalled();
    expect(originOf(reader)).not.toEqual(before);
    expect(app.store.state.editor.selectedMap).toEqual({});
    expect(editsOf(reader)).toEqual([]);
  });

  it('leaves the document and the edit state as they were under the chords that edit', async () => {
    const reader = await mountReader();
    const { app, shell } = reader;
    const { doc } = app.store.state;
    const before = {
      tableIds: [...doc.tableIds],
      memoIds: [...doc.memoIds],
      tableGroupIds: [...doc.tableGroupIds],
      relationshipIds: [...doc.relationshipIds],
    };

    chordOn(shell, 'n', 'KeyN', { alt: true });
    chordOn(shell, 'm', 'KeyM', { alt: true });
    chordOn(shell, '1', 'Digit1', { mod: true, alt: true });
    chordOn(shell, 'g', 'KeyG', { alt: true });
    chordOn(shell, 'Delete', 'Delete');
    await settleScene();

    expect({
      tableIds: doc.tableIds,
      memoIds: doc.memoIds,
      tableGroupIds: doc.tableGroupIds,
      relationshipIds: doc.relationshipIds,
    }).toEqual(before);
    expectNoEditState(reader);
    expect(app.store.state.editor.drawTableGroup).toBe(false);
    expect(app.store.state.editor.selectedMap).toEqual({});
    expect(editsOf(reader)).toEqual([]);
  });

  it('opens no colour picker, and holds a middle press over a takeover with its lift', async () => {
    const reader = await mountReader();
    const { app, container } = reader;
    app.emitter.emit(
      openColorPickerAction({ x: 200, y: 200, color: '#ffffff' })
    );
    await flush(6);
    expect(container.querySelector('.color-picker')).toBeNull();

    app.emitter.emit(openDiffViewerAction({ value: toJson(app.store.state) }));
    await settleScene();
    const pane = container.querySelector('.diff-viewer-insert') as HTMLElement;
    const press = pressWith(pane, MIDDLE, { clientX: 500, clientY: 300 });
    const lift = liftWith(pane, MIDDLE);
    expect(press.defaultPrevented).toBe(true);
    expect(lift.defaultPrevented).toBe(true);
  });

  it('lets a diff pane press select as it does in an editor, and pans nothing under it', async () => {
    const reader = await mountReader();
    const { app, stage } = reader;
    app.emitter.emit(openDiffViewerAction({ value: toJson(app.store.state) }));
    await settleScene();
    const before = originOf(reader);

    const [pane] = stages.filter(
      candidate =>
        candidate !== stage && candidate.findOne('#table-users') !== undefined
    );
    await clickAt(pane, headerCellOf(pane, 'users'));

    expect(pane.findOne('#table-users')!.getAttr('selected')).toBe(true);
    expect(app.store.state.editor.selectedMap).toEqual({});
    expect(originOf(reader)).toEqual(before);
  });
});

/** Every control that edits is gone from the scene, and the colour edges take no press. */
function expectNoEditControls({ stage, container }: Reader) {
  for (const name of [
    '.table-add-column',
    '.table-remove',
    '.column-remove',
    '.memo-remove',
    '.memo-sash',
    '.table-group-sash',
    '.table-group-remove',
    '.column-drag-handle',
  ]) {
    expect([name, stage.find(name).length]).toEqual([name, 0]);
  }
  expect(
    stage.find('.table-header-color').every(node => !node.listening())
  ).toBe(true);
  expect(stage.findOne('.memo-header-color')!.listening()).toBe(false);
  expect(container.querySelector('.edit-overlay')).toBeNull();
}

/** Turns the reader's element readonly or writable and waits for the scene it draws. */
async function turnReader(readonly: boolean) {
  elementFlags.readonly = readonly;
  await settleScene();
}

/** How many of the stage's hover listeners the read-only press rule holds. */
const hoverListenersOf = (stage: Stage) =>
  (stage.eventListeners.mouseover ?? []).filter(
    ({ name }) => name === 'sceneHover'
  ).length;

/** Where the sort left a relationship's two ends, which its connector is drawn from. */
const anchorsOf = ({ app }: Reader, id: string) => {
  const { start, end } = app.store.state.collections.relationshipEntities[id];
  return [start, end].map(({ x, y, direction }) => ({ x, y, direction }));
};

/** The canvas stage the reader's container holds now, the one it drew first or a new one. */
const liveStageOf = ({ container }: Reader) => {
  const canvas = container.querySelector('[data-testid="erd-canvas"]');
  return stages.find(candidate => candidate.container() === canvas);
};

/**
 * What a readonly reader meets: a press or a double click edits nothing and
 * selects nothing, nothing that edits is drawn, and a drag on a table pans.
 */
async function expectReading(reader: Reader) {
  const { app, container, stage } = reader;
  reader.sent.length = 0;

  await clickAt(stage, headerCellOf(stage, 'users'));
  await doubleClickAt(stage, columnCellOf(stage, 'orders.user'));
  expect(editsOf(reader)).toEqual([]);
  expectNoEditState(reader);
  expect(app.store.state.editor.selectedMap).toEqual({});
  expectNoEditControls(reader);
  expect(toolbarOf(container)).toEqual(READ_TOOLBAR);

  const before = originOf(reader);
  const users = tablePointOf(reader, 'users');
  await dragFrom(stage, headerCellOf(stage, 'users'), { x: 60, y: 30 });
  expect(originOf(reader)).toEqual({
    originX: before.originX + 60,
    originY: before.originY + 30,
  });
  expect(tablePointOf(reader, 'users')).toEqual(users);
}

describe('Erd - an editor turned readonly at run time', () => {
  it('reads while readonly and edits from an empty edit state once writable, on the one stage', async () => {
    const reader = await mountReader();
    const { app, container, stage } = reader;
    await expectReading(reader);

    await turnReader(false);
    expect(liveStageOf(reader)).toBe(stage);
    expectNoEditState(reader);
    expect(app.store.state.editor.selectedMap).toEqual({});
    expect(container.querySelector('.edit-overlay')).toBeTruthy();
    expect(stage.find('.table-add-column').length).toBeGreaterThan(0);
    expect(stage.find('.table-group-sash').length).toBeGreaterThan(0);
    expect(toolbarOf(container)).toEqual(EDIT_TOOLBAR);

    await clickAt(stage, headerCellOf(stage, 'users'));
    expect(app.store.state.editor.selectedMap).toEqual({
      users: SelectType.table,
    });
    const users = tablePointOf(reader, 'users');
    await dragFrom(stage, headerCellOf(stage, 'users'), { x: 40, y: 20 });
    expect(tablePointOf(reader, 'users')).toEqual({
      x: users.x + 40,
      y: users.y + 20,
    });

    await turnReader(true);
    expect(liveStageOf(reader)).toBe(stage);
    expect(app.store.state.editor.selectedMap).toEqual({});
    expect(app.store.state.editor.focusTable).toBeNull();
    await expectReading(reader);
  });

  it('draws what mounts after the turn under read: a table scrolled in, a peer’s table and the zoomed out tables', async () => {
    const reader = await mountReader({ readonly: false });
    const { app, stage } = reader;
    app.store.dispatchSync(
      addTableAction({ id: 'far', ui: { x: 2400, y: 40, zIndex: 3 } })
    );
    await settleScene();
    expect(stage.findOne('#table-far')).toBeUndefined();

    await turnReader(true);
    const readsAt = async (id: string) => {
      const table = stage.findOne<Group>(`#table-${id}`)!;
      expect(table.find('.table-add-column')).toHaveLength(0);
      expect(table.findOne('.table-header-color')!.listening()).toBe(false);
      reader.sent.length = 0;
      await clickAt(stage, middleOfNode(table.findOne('.tableName')!));
      expect(editsOf(reader)).toEqual([]);
      expect(app.store.state.editor.selectedMap).toEqual({});
    };

    const { originY } = app.store.state.settings;
    app.store.dispatchSync(scrollToAction({ originX: -2300, originY }));
    await settleScene();
    await readsAt('far');

    app.store.dispatchSync(scrollToAction({ originX: 0, originY }));
    app.store.dispatchSync(
      attachActionTag(
        Tag.shared,
        addTableAction({ id: 'peer', ui: { x: 40, y: 200, zIndex: 4 } })
      )
    );
    await settleScene();
    await readsAt('peer');

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await settleScene();
    expect(stage.find('.table-add-column')).toHaveLength(0);
    const edges = stage.find('.table-header-color');
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every(edge => !edge.listening())).toBe(true);
    expect(liveStageOf(reader)).toBe(stage);
  });

  it('hears the pointer only while readonly, by one listener, and puts out what it lit at each turn', async () => {
    const reader = await mountReader({ readonly: false });
    const { app, stage } = reader;
    const editorId = app.store.state.editor.id;
    expect(hoverListenersOf(stage)).toBe(0);

    await turnReader(true);
    expect(hoverListenersOf(stage)).toBe(1);
    hoverAt(stage, headerCellOf(stage, 'users'));
    await settleScene();
    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(true);

    await turnReader(false);
    expect(hoverListenersOf(stage)).toBe(0);
    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(false);
    hoverAt(stage, bareOf(stage));
    hoverAt(stage, headerCellOf(stage, 'orders'));
    await settleScene();
    expect(isRelationshipHighlighted(editorId, 'fk')).toBe(false);

    await turnReader(true);
    expect(hoverListenersOf(stage)).toBe(1);
  });

  it('writes nothing for a group sash drag the turn cut short', async () => {
    const reader = await mountReader({ readonly: false });
    const { app, stage } = reader;
    const groupUi = () => ({
      ...app.store.state.collections.tableGroupEntities.group.ui,
    });
    const before = groupUi();

    const down = pointerAt(
      stage,
      'mousedown',
      nodeCenter(stage, '.table-group-sash-right')
    );
    for (const step of [20, 40]) {
      movePointer(down.clientX + step, down.clientY);
      await flush();
    }

    await turnReader(true);
    movePointer(down.clientX + 80, down.clientY);
    await flush();
    releasePointer(down.clientX + 80, down.clientY);
    await settleScene();

    expect(groupUi()).toEqual(before);
    expect(reader.sent.map(({ type }) => type)).not.toContain(
      'tableGroup.resize'
    );
  });

  it('selects nothing more for a marquee the turn cut short, and sends its rect no further', async () => {
    const reader = await mountReader({ readonly: false });
    const { app, stage } = reader;
    const mod = { ctrlKey: !APPLE, metaKey: APPLE };
    const from = bareOf(stage);
    const sweep = async (to: Point) => {
      pointerAt(stage, 'mousemove', to, mod);
      await settleScene();
    };

    pointerAt(stage, 'mousedown', from, mod);
    await sweep({ x: 400, y: 200 });
    expect(app.store.state.editor.selectedMap).toEqual({
      orders: SelectType.table,
    });
    expect(app.store.state.editor.dragSelect).not.toBeNull();
    expect(stage.findOne('#drag-select')).toBeTruthy();

    await turnReader(true);
    reader.sent.length = 0;
    await sweep({ x: 10, y: 200 });

    expect(app.store.state.editor.selectedMap).toEqual({});
    expect(app.store.state.editor.dragSelect).toBeNull();
    expect(stage.findOne('#drag-select')).toBeUndefined();

    releasePointer();
    await settleScene();
    expect(app.store.state.editor.selectedMap).toEqual({});
    expect(reader.sent.map(({ type }) => type)).not.toContain('editor.select');
  });

  it('takes away a menu over a relationship, a memo or a group as it turns readonly, and redraws a table or canvas menu’s rows either way', async () => {
    const reader = await mountReader({ readonly: false });
    const { stage, container } = reader;
    const menu = () => container.querySelector('.context-menu-content');

    for (const selector of [
      '.relationship-hit-area',
      '.memo-textarea',
      '.table-group-title-bar',
      '.table-group-body',
    ]) {
      await rightClickAt(stage, nodeCenter(stage, selector));
      expect(menuRowsOf(container)).toContain('Delete');
      await turnReader(true);
      expect(menu()).toBeNull();
      await turnReader(false);
    }

    await rightClickAt(stage, columnCellOf(stage, 'users.id'));
    expect(menuRowsOf(container)).toContain('Primary Key');
    await turnReader(true);
    expect(menuRowsOf(container)).toEqual(['Table Properties']);
    await turnReader(false);
    expect(menuRowsOf(container)).toContain('Primary Key');

    await rightClickAt(stage, bareOf(stage));
    expect(menuRowsOf(container)).toEqual(EDIT_CANVAS_MENU);
    await turnReader(true);
    expect(menuRowsOf(container)).toEqual(READ_CANVAS_MENU);
    await turnReader(false);
    expect(menuRowsOf(container)).toEqual(EDIT_CANVAS_MENU);
  });

  it('lists an open palette’s rows anew at each turn, the rows that edit back once writable', async () => {
    const reader = await mountReader();
    await openPalette(reader);
    expect(paletteRowsOf(reader)).toEqual(READ_PALETTE);

    await turnReader(false);
    expect(paletteRowsOf(reader)).toEqual(EDIT_PALETTE);

    await turnReader(true);
    expect(paletteRowsOf(reader)).toEqual(READ_PALETTE);
    expect(editsOf(reader)).toEqual([]);
  });

  it('takes a palette held open on Import back to its top level as it turns readonly', async () => {
    const reader = await mountReader({ readonly: false });
    await openPalette(reader);
    await pickPaletteRow(reader, 'Import');
    expect(paletteRowsOf(reader)).toEqual([
      'json',
      'Schema SQL',
      'GraphQL',
      'DBML',
      'AML',
    ]);

    await turnReader(true);
    expect(paletteRowsOf(reader)).toEqual(READ_PALETTE);

    await turnReader(false);
    expect(paletteRowsOf(reader)).toEqual(EDIT_PALETTE);
    expect(editsOf(reader)).toEqual([]);
  });

  it('gives a View Option row back as it turns writable, laying the connectors out again', async () => {
    const reader = await mountReader();
    const { app } = reader;
    const { show } = app.store.state.settings;
    expect(show & Show.columnDataType).toBeTruthy();
    const anchors = anchorsOf(reader, 'fk');
    const value = documentJsonOf(app.store);

    app.store.dispatchSync(
      changeShowAction({ show: Show.columnDataType, value: false })
    );
    await settleScene();
    expect(app.store.state.settings.show & Show.columnDataType).toBe(0);
    expect(anchorsOf(reader, 'fk')).not.toEqual(anchors);
    expect(documentJsonOf(app.store)).toBe(value);

    await turnReader(false);

    expect(app.store.state.settings.show).toBe(show);
    expect(app.store.state.editor.screenBaseline?.show).toBeUndefined();
    expect(anchorsOf(reader, 'fk')).toEqual(anchors);
    expect(documentJsonOf(app.store)).toBe(value);
  });
});
