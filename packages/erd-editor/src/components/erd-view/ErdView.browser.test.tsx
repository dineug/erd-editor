import { toJson } from '@dineug/erd-editor-schema';
import { addCSSHost, createRef, render, useProvider } from '@dineug/r-html';
import { whenDrawn } from '@dineug/r-html-konva';
import type { Group } from 'konva/lib/Group';
import { type Stage, stages } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestTheme,
  flush,
  movePointer,
  moveScenePointer,
} from '@/__test-utils__';
import { type DiffSeed, diffStateOf } from '@/__test-utils__/diffSeed';
import { iconNameOf } from '@/__test-utils__/icon';
import type { AppContext } from '@/components/appContext';
import {
  countTransitions,
  transitionKey,
  transitionTo,
} from '@/components/erd/canvas/highlightTransition';
import {
  countRelationshipHighlights,
  isRelationshipHighlighted,
} from '@/components/erd/relationshipHighlight';
import ErdView, { type ErdViewProps } from '@/components/erd-view/ErdView';
import * as paletteStyles from '@/components/quick-search/QuickSearch.styles';
import { themeContext } from '@/components/themeContext';
import { CANVAS_ZOOM_MAX } from '@/constants/schema';
import { ZOOM_STEP } from '@/constants/zoom';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { getContentRect } from '@/konva/scene/contentBounds';
import { previewZoomLevel } from '@/konva/scene/fitZoom';

const VIEWPORT = { width: 1000, height: 600 };

const theme = createTestTheme();

/** The modifier $mod resolves to, read off the platform the way hasAppleDevice reads it. */
const APPLE = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

type Point = { x: number; y: number };

type Mounted = {
  appRef: { value: AppContext | null };
  host: HTMLDivElement;
  shadow: ShadowRoot;
  /** Renders the view again with the props a host now hands it. */
  rerender: (props: Partial<ErdViewProps>) => void;
  unmount: () => void;
};

type View = Mounted & {
  app: AppContext;
  root: HTMLDivElement;
  stage: Stage;
};

const SEED: DiffSeed = {
  tables: [
    {
      id: 'users',
      name: 'users',
      x: 80,
      y: 80,
      columns: [{ id: 'users.id', name: 'id', pk: true }],
    },
    {
      id: 'orders',
      name: 'orders',
      x: 480,
      y: 80,
      columns: [{ id: 'orders.user', name: 'user_id' }],
    },
    { id: 'notes', name: 'notes', x: 80, y: 360 },
  ],
  relationships: [
    {
      id: 'fk',
      parent: ['users', ['users.id']],
      child: ['orders', ['orders.user']],
    },
  ],
  memos: [{ id: 'memo', value: 'read me', x: 480, y: 360 }],
  groups: [
    { id: 'group', name: 'Billing', x: 700, y: 300, width: 240, height: 200 },
  ],
};

/** Bare canvas, past every entity the seed places. */
const BARE: Point = { x: 960, y: 30 };

const teardowns: Array<() => void> = [];

afterEach(async () => {
  // A press that reached the pan subscribes to the global drag stream, and
  // only a global lift completes it.
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  teardowns.splice(0).forEach(teardown => teardown());
  vi.unstubAllGlobals();
  await whenDrawn();
});

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** Drawn and settled, the hit canvas included, which lands a frame after the draw. */
async function settle(rounds = 3) {
  for (let round = 0; round < rounds; round++) {
    await flush();
    await whenDrawn();
    await nextFrame();
  }
}

function stageOf(shadow: ShadowRoot): Stage {
  const canvas = shadow.querySelector('[data-testid="erd-canvas"]');
  return stages.find(stage => stage.container() === canvas)!;
}

/**
 * Mounts a view where its stylesheets are live, in a shadow root as the element
 * has one, inside a box of the viewport's size that it fills.
 */
function mountShadow({
  handsApp = true,
  props = {},
}: { handsApp?: boolean; props?: Partial<ErdViewProps> } = {}): Mounted {
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const box = document.createElement('div');
  box.style.width = `${VIEWPORT.width}px`;
  box.style.height = `${VIEWPORT.height}px`;
  shadow.append(box);

  // useProvider takes a bare HTMLElement at runtime but types only a component
  // context, hence the cast; it is r-html's, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(box as any, themeContext, theme);
  const appRef = createRef<AppContext | null>(null);
  const draw = (next: Partial<ErdViewProps>) =>
    render(
      box,
      handsApp ? (
        <ErdView
          appRef={appRef}
          minimap={next.minimap}
          controls={next.controls}
          status={next.status}
        />
      ) : (
        <ErdView />
      )
    );
  draw(props);

  let mounted = true;
  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    render(box, null);
    themeProvider.destroy();
    host.remove();
  };
  teardowns.push(unmount);

  return { appRef, host, shadow, rerender: draw, unmount };
}

/** A view mounted and measured, with the seed loaded into its store. */
async function mountView(
  seed: DiffSeed = SEED,
  props: Partial<ErdViewProps> = {}
): Promise<View> {
  const mounted = mountShadow({ props });
  await settle();

  const app = mounted.appRef.value!;
  app.store.dispatchSync(initialLoadJsonAction$(toJson(diffStateOf(seed))));
  await settle();

  return {
    ...mounted,
    app,
    root: mounted.shadow.querySelector<HTMLDivElement>('.erd-view')!,
    stage: stageOf(mounted.shadow),
  };
}

const centerOf = (stage: Stage, selector: string): Point => {
  const rect = stage.findOne(selector)!.getClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};

/** A native pointer event at a point of the stage, on the canvas konva draws into, as a browser delivers one. */
function pointer(
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
    clientX: content.left + x,
    clientY: content.top + y,
    ...init,
  });
  stage.content.querySelector('canvas')!.dispatchEvent(event);
  return event;
}

/** A press and its lift where it stood, the click konva makes of them included. */
async function click(stage: Stage, point: Point, init: MouseEventInit = {}) {
  pointer(stage, 'mousedown', point, init);
  pointer(stage, 'mouseup', point, init);
  await settle();
}

/** Two clicks inside konva's window, the second carrying the browser's count of two. */
async function doubleClick(stage: Stage, point: Point) {
  pointer(stage, 'mousedown', point, { detail: 1 });
  pointer(stage, 'mouseup', point, { detail: 1 });
  pointer(stage, 'mousedown', point, { detail: 2 });
  pointer(stage, 'mouseup', point, { detail: 2 });
  await settle();
}

/** A touch on the canvas carrying the points given, which konva and the root both read. */
function touch(stage: Stage, type: string, points: Point[]) {
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

/** One finger moved to a point of the stage, heard on the window as a browser sends it there. */
function fingerMove(stage: Stage, { x, y }: Point) {
  const content = stage.content.getBoundingClientRect();
  window.dispatchEvent(
    new TouchEvent('touchmove', {
      bubbles: true,
      cancelable: true,
      touches: [
        new Touch({
          identifier: 1,
          target: stage.content.querySelector('canvas')!,
          clientX: content.left + x,
          clientY: content.top + y,
        }),
      ],
    })
  );
}

function wheel(root: HTMLElement, init: WheelEventInit): WheelEvent {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  root.dispatchEvent(event);
  return event;
}

function chord(root: HTMLElement, key: string, code: string, mod = false) {
  const event = new KeyboardEvent('keydown', {
    key,
    code,
    ctrlKey: mod && !APPLE,
    metaKey: mod && APPLE,
    bubbles: true,
    cancelable: true,
  });
  root.dispatchEvent(event);
  return event;
}

/** A click on a control the way a reader makes one, its press reaching the root first. */
async function press(el: Element) {
  for (const type of ['mousedown', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true }));
  }
  await settle();
}

/** A pointer moving onto a point of the stage, which konva tells the shapes there of. */
const hover = (stage: Stage, { x, y }: Point) => moveScenePointer(stage, x, y);

const lit = ({ app }: View, relationshipId = 'fk') =>
  isRelationshipHighlighted(app.store.state.editor.id, relationshipId);

const routeStroke = ({ stage }: View) =>
  stage.findOne('.relationship-route')!.getAttr('stroke');

const origin = ({ app }: View) => {
  const { originX, originY } = app.store.state.settings;
  return { originX, originY };
};

const headerCell = (stage: Stage, tableId: string) =>
  stage.findOne<Group>(`#table-${tableId}`)!.findOne('.tableName')!;

const columnCell = (stage: Stage, columnId: string) =>
  stage.findOne<Group>(`#column-${columnId}`)!.findOne('.columnName')!;

const pointOf = (node: { getClientRect(): Record<string, number> }) => {
  const rect = node.getClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};

describe('ErdView - its own store', () => {
  it('starts on an empty viewport and takes its box once measured', async () => {
    const app = mountShadow().appRef.value!;
    expect(app.store.getReadonly()).toBe(true);
    expect(app.store.state.editor.viewport).toEqual({ width: 0, height: 0 });

    await settle();

    expect(app.store.state.editor.viewport).toEqual(VIEWPORT);
  });

  it('hands its app to the host and takes it back as it goes', async () => {
    const view = await mountView();

    expect(view.app.store.state.doc.tableIds).toEqual([
      'users',
      'orders',
      'notes',
    ]);

    view.unmount();

    expect(view.appRef.value).toBeNull();
    expect(view.app.lifecycle.destroyed).toBe(true);
  });

  it('mounts without a host asking for its app', async () => {
    const { shadow, unmount } = mountShadow({ handsApp: false });
    await settle();

    expect(shadow.querySelector('.erd-view')!.getAttribute('tabindex')).toBe(
      '0'
    );
    expect(shadow.querySelector('[data-testid="erd-canvas"]')).not.toBeNull();

    unmount();
    expect(shadow.querySelector('.erd-view')).toBeNull();
  });
});

describe('ErdView - the press and the light (AC-V6)', () => {
  it('lights a table’s relationships while the pointer rests on it, and puts them out as it leaves', async () => {
    const view = await mountView();
    const unlit = routeStroke(view);

    hover(view.stage, centerOf(view.stage, '#table-notes'));
    await settle();
    expect(lit(view)).toBe(false);

    const users = centerOf(view.stage, '#table-users');
    hover(view.stage, users);
    await settle();
    expect(lit(view)).toBe(true);
    expect(routeStroke(view)).toBe(theme.relationshipHover);

    hover(view.stage, BARE);
    await settle();
    expect(lit(view)).toBe(false);
    expect(routeStroke(view)).toBe(unlit);

    hover(view.stage, users);
    await settle();
    view.stage.content.dispatchEvent(new MouseEvent('mouseleave'));
    await settle();
    expect(lit(view)).toBe(false);
  });

  it('keeps the light a still click on a table set, and a still click on bare canvas puts it out', async () => {
    const view = await mountView();
    const users = centerOf(view.stage, '#table-users');

    hover(view.stage, users);
    await click(view.stage, users);
    hover(view.stage, BARE);
    await settle();
    expect(lit(view)).toBe(true);

    await click(view.stage, BARE);
    expect(lit(view)).toBe(false);
  });

  it('lights a relationship a still click lands on, and puts it out for a memo', async () => {
    const view = await mountView();

    await click(view.stage, centerOf(view.stage, '.relationship-hit-area'));
    hover(view.stage, BARE);
    await settle();
    expect(lit(view)).toBe(true);

    await click(view.stage, centerOf(view.stage, '#memo-memo'));
    expect(lit(view)).toBe(false);
  });

  it('pans a drag wherever it starts, a table included, and lights nothing for it', async () => {
    const view = await mountView();
    const users = centerOf(view.stage, '#table-users');
    const before = origin(view);

    const down = pointer(view.stage, 'mousedown', users);
    movePointer(down.clientX + 60, down.clientY + 30);
    await settle();
    expect(view.root.style.cursor).toBe('grabbing');
    pointer(view.stage, 'mouseup', { x: users.x + 60, y: users.y + 30 });
    await settle();

    expect(origin(view)).not.toEqual(before);
    expect(view.root.style.cursor).toBe('');
    expect(Object.keys(view.app.store.state.editor.selectedMap)).toEqual([]);
    hover(view.stage, BARE);
    await settle();
    expect(lit(view)).toBe(false);
  });

  it("lights on a finger's still tap, and a second finger ends the press with no light", async () => {
    const view = await mountView();
    const users = centerOf(view.stage, '#table-users');

    touch(view.stage, 'touchstart', [users]);
    touch(view.stage, 'touchend', [users]);
    await settle();
    expect(lit(view)).toBe(true);

    await click(view.stage, BARE);
    touch(view.stage, 'touchstart', [users]);
    touch(view.stage, 'touchstart', [users, { x: users.x + 80, y: users.y }]);
    touch(view.stage, 'touchend', [users]);
    await settle();
    expect(lit(view)).toBe(false);
  });

  it('takes the selection a palette jump left on the next still click', async () => {
    const view = await mountView();
    view.root.focus();
    chord(view.root, 'k', 'KeyK', true);
    await settle();

    const input = view.shadow.querySelector<HTMLInputElement>(
      '.quick-search input'
    )!;
    input.value = '#users';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();
    view.shadow
      .querySelector('.quick-search-row')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(view.app.store.state.editor.selectedMap).toHaveProperty('users');

    await click(view.stage, BARE);
    expect(view.app.store.state.editor.selectedMap).toEqual({});
  });
});

/**
 * What a press in an editing scene sends to focus, select or edit, none of which
 * a read scene may send. A still press then sends the unselect that takes what a
 * jump left, which would hide a focus sent ahead of it, so the record is read.
 */
const EDITS = new Set([
  'editor.focusTable',
  'editor.focusColumn',
  'editor.editTable',
  'editor.editMemo',
  'editor.editTableGroup',
  'editor.select',
  'editor.selectAll',
  'editor.selectAllColumn',
]);

/** The edits among the actions the view's store takes from now on. */
function recordEdits({ app }: View): string[] {
  const edits: string[] = [];
  teardowns.push(
    app.store.subscribe(actions => {
      edits.push(
        ...actions.map(({ type }) => type).filter(type => EDITS.has(type))
      );
    })
  );
  return edits;
}

describe('ErdView - a read scene edits nothing', () => {
  it('focuses no cell and selects nothing for a press on a header cell or a column cell', async () => {
    const view = await mountView();
    const edits = recordEdits(view);
    const { editor } = view.app.store.state;
    const header = pointOf(headerCell(view.stage, 'users'));

    pointer(view.stage, 'mousedown', header);
    await settle();
    expect(view.stage.find('.cell-focus-border')).toHaveLength(0);
    pointer(view.stage, 'mouseup', header);
    await settle();

    await click(view.stage, pointOf(columnCell(view.stage, 'users.id')));
    await click(view.stage, pointOf(columnCell(view.stage, 'orders.user')), {
      button: 2,
    });

    expect(edits).toEqual([]);
    expect(editor.focusTable).toBeNull();
    expect(editor.selectedMap).toEqual({});
    expect(view.stage.find('.cell-focus-border')).toHaveLength(0);
    expect(view.stage.findOne('#table-users')!.getAttr('selected')).toBe(false);
  });

  it('opens no editor for a double click or Enter, and keeps the keyboard where it was (AC-V12)', async () => {
    const view = await mountView();
    const edits = recordEdits(view);
    view.root.focus();

    await doubleClick(view.stage, pointOf(headerCell(view.stage, 'users')));
    await doubleClick(view.stage, pointOf(columnCell(view.stage, 'users.id')));
    const enter = chord(view.root, 'Enter', 'Enter');
    await settle();

    expect(edits).toEqual([]);
    expect(enter.defaultPrevented).toBe(false);
    expect(view.shadow.querySelector('.edit-overlay')).toBeNull();
    expect(view.app.store.state.editor.focusTable).toBeNull();
    expect(view.stage.find('.cell-text').every(node => node.visible())).toBe(
      true
    );
    expect(view.shadow.activeElement).toBe(view.root);
    expect(document.activeElement).toBe(view.host);
  });

  it('draws no button that edits, and its colour edges and sashes take no press', async () => {
    const view = await mountView();
    const users = centerOf(view.stage, '#table-users');
    hover(view.stage, users);
    await settle();

    for (const name of [
      '.table-add-column',
      '.table-remove',
      '.column-remove',
      '.memo-remove',
      '.memo-sash',
    ]) {
      expect(view.stage.find(name)).toHaveLength(0);
    }
    expect(
      view.stage.find('.table-header-color').every(node => !node.listening())
    ).toBe(true);
    expect(view.stage.findOne('.memo-header-color')!.listening()).toBe(false);

    view.app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await settle();

    const zoomedOut = view.stage.findOne<Group>('#table-users')!;
    expect(zoomedOut.name()).toContain('high-level-table');
    expect(zoomedOut.findOne('.table-header-color')!.listening()).toBe(false);
  });

  it('opens no memo editor and scrolls no memo body, leaving the wheel to the root', async () => {
    const view = await mountView();
    const memo = centerOf(view.stage, '.memo-textarea');

    const edits = recordEdits(view);
    await click(view.stage, memo);
    expect(edits).toEqual([]);
    expect(view.app.store.state.editor.editMemoId).toBeNull();

    const before = origin(view);
    view.root.focus();
    const content = view.stage.content.getBoundingClientRect();
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 80,
      clientX: content.left + memo.x,
      clientY: content.top + memo.y,
    });
    view.stage.content.querySelector('canvas')!.dispatchEvent(event);
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(origin(view)).not.toEqual(before);
  });

  it('selects no group for a right press on its body', async () => {
    const view = await mountView();
    const body = centerOf(view.stage, '.table-group-body');
    const edits = recordEdits(view);

    await click(view.stage, body, { button: 2 });

    expect(edits).toEqual([]);
    expect(view.app.store.state.editor.selectedMap).toEqual({});
  });
});

describe('ErdView - the wheel and the touch wait for the focus', () => {
  it('lets the page keep a wheel before the focus, and pans and zooms after it', async () => {
    const view = await mountView();
    const before = origin(view);
    const zoom = view.app.store.state.settings.zoomLevel;

    const early = wheel(view.root, { deltaY: 100 });
    const pinch = wheel(view.root, { deltaY: 2, ctrlKey: true });
    await settle();
    expect(early.defaultPrevented).toBe(false);
    expect(pinch.defaultPrevented).toBe(false);
    expect(origin(view)).toEqual(before);
    expect(view.app.store.state.settings.zoomLevel).toBe(zoom);
    expect(getComputedStyle(view.root).touchAction).toBe('auto');

    view.root.focus();
    expect(getComputedStyle(view.root).touchAction).toBe('none');

    const plain = wheel(view.root, { deltaY: 100 });
    await settle();
    expect(plain.defaultPrevented).toBe(true);
    expect(origin(view).originY).not.toBe(before.originY);

    const across = origin(view);
    wheel(view.root, { deltaY: 100, shiftKey: true });
    await settle();
    expect(origin(view).originX).not.toBe(across.originX);
    expect(origin(view).originY).toBe(across.originY);

    wheel(view.root, {
      deltaY: -100,
      ctrlKey: !APPLE,
      metaKey: APPLE,
    });
    await settle();
    expect(view.app.store.state.settings.zoomLevel).toBeGreaterThan(zoom);

    const pinched = view.app.store.state.settings.zoomLevel;
    const late = wheel(view.root, { deltaY: 2, ctrlKey: true });
    await settle();
    expect(late.defaultPrevented).toBe(true);
    expect(view.app.store.state.settings.zoomLevel).not.toBe(pinched);

    view.root.blur();
    expect(wheel(view.root, { deltaY: 100 }).defaultPrevented).toBe(false);
  });
});

describe('ErdView - the view controls', () => {
  it('stands left to right, with the zoom, the fit and the name view', async () => {
    const view = await mountView();
    const bar = view.shadow.querySelector<HTMLElement>('.view-controls')!;

    expect(bar.dir).toBe('ltr');
    expect(bar.querySelector('.zoom-level')).not.toBeNull();
    expect(bar.querySelector('.view-fit')).not.toBeNull();
    expect(bar.querySelector('.name-view-trigger')).not.toBeNull();
    expect(view.shadow.querySelector('.minimap')).not.toBeNull();
  });

  it('zooms in from the bar and fits the document from it', async () => {
    const view = await mountView();
    const { settings, editor } = view.app.store.state;
    const zoom = settings.zoomLevel;
    const zoomIn = view.shadow.querySelectorAll(
      '.view-controls > div'
    )[2] as HTMLElement;

    await press(zoomIn);
    expect(settings.zoomLevel).toBeCloseTo(zoom + ZOOM_STEP);

    await press(view.shadow.querySelector('.view-fit')!);
    expect(settings.zoomLevel).toBe(
      previewZoomLevel(
        getContentRect(view.app.store.state)!,
        editor.viewport,
        CANVAS_ZOOM_MAX
      )
    );
  });

  it('shows the compass while the screen holds no content, and goes back to it', async () => {
    const view = await mountView();
    expect(view.shadow.querySelector('.content-compass')).toBeNull();

    view.app.store.dispatchSync(
      scrollToAction({ originX: -5000, originY: -5000 })
    );
    await settle();
    await press(view.shadow.querySelector('.content-compass')!);

    expect(view.shadow.querySelector('.content-compass')).toBeNull();
  });

  it('draws no map for an empty document', async () => {
    const view = await mountView({});

    expect(view.shadow.querySelector('.minimap')).toBeNull();
  });
});

describe('ErdView - what its host turns off and tells', () => {
  it('hides the map and the controls bar a host turns off, and draws them again for anything else', async () => {
    const view = await mountView(SEED, { minimap: false, controls: false });

    expect(view.shadow.querySelector('.minimap')).toBeNull();
    expect(view.shadow.querySelector('.view-controls')).toBeNull();
    expect(view.shadow.querySelector('.name-view-trigger')).toBeNull();

    view.rerender({ minimap: true });
    await settle();
    expect(view.shadow.querySelector('.minimap')).not.toBeNull();
    expect(view.shadow.querySelector('.view-controls')).not.toBeNull();
  });

  it('draws a turning loader while its host loads and a warning once the load failed, over the canvas and in the root’s direction', async () => {
    const view = await mountView(SEED, { status: 'loading' });
    const notice = () =>
      view.shadow.querySelector<HTMLElement>('.erd-view > .view-status');

    expect(notice()?.getAttribute('role')).toBe('status');
    expect(iconNameOf(notice())).toBe('loader-circle');
    expect(notice()?.textContent).toBe('Loading diagram');
    expect(notice()?.closest('[dir]')).toBe(view.root);
    expect(getComputedStyle(notice()!).pointerEvents).toBe('none');
    expect(
      getComputedStyle(notice()!.querySelector('svg')!).animationName
    ).toContain('viewStatusSpin');

    view.rerender({ status: 'error' });
    await settle();
    expect(notice()?.getAttribute('role')).toBe('alert');
    expect(iconNameOf(notice())).toBe('triangle-alert');
    expect(notice()?.textContent).toBe("Couldn't load the diagram");

    view.rerender({ status: 'idle' });
    await settle();
    expect(notice()).toBeNull();
  });

  it('puts out the light a press left once a document is loaded in place of the one it lit', async () => {
    const view = await mountView();
    await click(view.stage, centerOf(view.stage, '#table-users'));
    expect(lit(view)).toBe(true);

    view.app.store.dispatchSync(
      initialLoadJsonAction$(toJson(diffStateOf(SEED)))
    );
    await settle();

    expect(lit(view)).toBe(false);
    expect(countRelationshipHighlights().editors).toBe(0);
  });
});

describe('ErdView - the focus a press gives', () => {
  it('takes the focus for a still tap, which Konva kept from the root, scrolling no page', async () => {
    const view = await mountView();
    const users = centerOf(view.stage, '#table-users');
    const focus = vi.spyOn(view.root, 'focus');

    touch(view.stage, 'touchstart', [users]);
    touch(view.stage, 'touchend', [users]);
    await settle();

    expect(view.root.matches(':focus-within')).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(lit(view)).toBe(true);

    focus.mockClear();
    await click(view.stage, BARE);
    expect(focus).not.toHaveBeenCalled();
  });

  it('pans no view and takes no focus for a finger dragged before the focus, and pans for one once it holds it', async () => {
    const view = await mountView();
    const users = centerOf(view.stage, '#table-users');
    const moved = { x: users.x + 80, y: users.y };
    const before = origin(view);

    touch(view.stage, 'touchstart', [users]);
    fingerMove(view.stage, moved);
    touch(view.stage, 'touchend', [moved]);
    await settle();

    expect(origin(view)).toEqual(before);
    expect(view.root.matches(':focus-within')).toBe(false);
    expect(lit(view)).toBe(false);

    view.root.focus();
    touch(view.stage, 'touchstart', [users]);
    fingerMove(view.stage, moved);
    touch(view.stage, 'touchend', [moved]);
    await settle();

    expect(origin(view).originX).not.toBe(before.originX);
    expect(lit(view)).toBe(false);
  });

  it('takes no focus and lights nothing for a finger the browser cancels for a scroll, however short its travel', async () => {
    const view = await mountView();
    const users = centerOf(view.stage, '#table-users');
    const nudged = { x: users.x + 2, y: users.y };
    const before = origin(view);

    touch(view.stage, 'touchstart', [users]);
    fingerMove(view.stage, nudged);
    window.dispatchEvent(new PointerEvent('pointercancel'));
    touch(view.stage, 'touchend', [nudged]);
    await settle();

    expect(origin(view)).toEqual(before);
    expect(view.root.matches(':focus-within')).toBe(false);
    expect(lit(view)).toBe(false);
  });
});

describe('ErdView - the palette', () => {
  it('opens on the chord and searches the document under a prefix, listing no command', async () => {
    const view = await mountView();
    view.root.focus();
    chord(view.root, 'k', 'KeyK', true);
    await settle();

    const input = view.shadow.querySelector<HTMLInputElement>(
      '.quick-search input'
    )!;
    const type = async (value: string) => {
      input.value = value;
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await settle();
    };
    const rows = () =>
      [...view.shadow.querySelectorAll('.quick-search-row')].map(
        row => row.textContent
      );

    expect(view.shadow.querySelector('.quick-search-hint')).not.toBeNull();
    expect(rows()).toEqual([]);

    await type('#');
    expect(rows()).toHaveLength(3);

    await type('users');
    expect(view.shadow.querySelector('.quick-search-empty')).not.toBeNull();
    expect(rows()).toEqual([
      expect.stringContaining('Search tables for "users"'),
      expect.stringContaining('Search columns for "users"'),
      expect.stringContaining('Search comments & memos for "users"'),
    ]);
  });

  it('hands the keyboard back to no one as it closes, so the page keeps the next wheel', async () => {
    const view = await mountView();
    view.root.focus();
    chord(view.root, 'k', 'KeyK', true);
    await settle();

    const input = view.shadow.querySelector<HTMLInputElement>(
      '.quick-search input'
    )!;
    expect(view.shadow.activeElement).toBe(input);
    expect(view.root.matches(':focus-within')).toBe(true);

    chord(input, 'Escape', 'Escape');
    await settle();

    expect(view.shadow.querySelector('.quick-search')).toBeNull();
    expect(view.shadow.activeElement).toBeNull();
    expect(view.root.matches(':focus-within')).toBe(false);
    expect(wheel(view.root, { deltaY: 100 }).defaultPrevented).toBe(false);
  });

  it('leaves a wheel over its list to the list, and holds a pinch there off the page with no zoom', async () => {
    const view = await mountView();
    view.root.focus();
    chord(view.root, 'k', 'KeyK', true);
    await settle();

    const input = view.shadow.querySelector<HTMLInputElement>(
      '.quick-search input'
    )!;
    input.value = '#';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();

    const list = view.shadow.querySelector<HTMLElement>(
      `.quick-search .${paletteStyles.list}`
    )!;
    const before = origin(view);
    const zoom = view.app.store.state.settings.zoomLevel;
    expect(list.querySelectorAll('.quick-search-row')).toHaveLength(3);

    const plain = wheel(list, { deltaY: 100 });
    const pinch = wheel(list, { deltaY: 2, ctrlKey: true });
    await settle();

    expect(view.shadow.activeElement).toBe(input);
    expect(plain.defaultPrevented).toBe(false);
    expect(pinch.defaultPrevented).toBe(true);
    expect(origin(view)).toEqual(before);
    expect(view.app.store.state.settings.zoomLevel).toBe(zoom);
  });
});

describe('ErdView - two views on one page (AC-V13)', () => {
  it('keeps each one’s store and light apart, and leaves nothing behind for the one removed', async () => {
    const before = countRelationshipHighlights();
    const first = await mountView();
    const second = await mountView({
      tables: [
        {
          id: 'a',
          name: 'a',
          x: 80,
          y: 80,
          columns: [{ id: 'a.id', name: 'id' }],
        },
        {
          id: 'b',
          name: 'b',
          x: 480,
          y: 80,
          columns: [{ id: 'b.a', name: 'a_id' }],
        },
      ],
      relationships: [
        { id: 'ab', parent: ['a', ['a.id']], child: ['b', ['b.a']] },
      ],
    });

    expect(first.app.store.state.editor.id).not.toBe(
      second.app.store.state.editor.id
    );
    expect(second.app.store.state.doc.tableIds).toEqual(['a', 'b']);

    await click(first.stage, centerOf(first.stage, '#table-users'));
    expect(lit(first)).toBe(true);
    expect(lit(second, 'ab')).toBe(false);

    const firstId = first.app.store.state.editor.id;
    transitionTo(transitionKey(firstId, 'table', 'users'), 1);
    expect(countTransitions(firstId)).toBe(1);

    first.unmount();
    await settle();

    expect(countTransitions(firstId)).toBe(0);
    expect(isRelationshipHighlighted(firstId, 'fk')).toBe(false);
    expect(countRelationshipHighlights().editors).toBe(before.editors);

    await click(second.stage, centerOf(second.stage, '#table-a'));
    expect(lit(second, 'ab')).toBe(true);
  });
});

describe('ErdView - no worker (AC-V17)', () => {
  it('constructs no SharedWorker and no Worker from mounting to the palette', async () => {
    const sharedWorker = vi.fn();
    const worker = vi.fn();
    vi.stubGlobal('SharedWorker', sharedWorker);
    vi.stubGlobal('Worker', worker);

    const view = await mountView();
    const users = centerOf(view.stage, '#table-users');
    hover(view.stage, users);
    await click(view.stage, users);
    view.root.focus();
    wheel(view.root, { deltaY: 100 });
    chord(view.root, '=', 'Equal', true);
    chord(view.root, 'k', 'KeyK', true);
    await settle();
    view.unmount();

    expect(sharedWorker).not.toHaveBeenCalled();
    expect(worker).not.toHaveBeenCalled();
  });
});
