import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AnyAction,
  createRef,
  FC,
  html,
  observable,
  ref,
} from '@dineug/r-html';
import { config as rxjsConfig } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import Erd from '@/components/erd/Erd';
import * as styles from '@/components/erd/Erd.styles';
import {
  getViewTransform,
  getVisibleCanvasRect,
} from '@/components/erd/minimap/minimapGeometry';
import * as tablePropertiesStyles from '@/components/erd/table-properties/TableProperties.styles';
import { Open } from '@/constants/open';
import { CanvasType, RelationshipType } from '@/constants/schema';
import { History } from '@/engine/history';
import {
  changeHandToolAction,
  changeOpenMapAction,
  changeZenModeAction,
  drawStartRelationshipAction,
  editTableAction,
  focusTableAction,
  sharedMouseTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import {
  addMemoAction,
  changeMemoColorAction,
} from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeCanvasTypeAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableNameAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { getContentRect } from '@/konva/scene/contentBounds';
import type { Rect } from '@/konva/scene/metrics';
import {
  openColorPickerAction,
  openDiffViewerAction,
  openTablePropertiesAction,
} from '@/utils/emitter';
import { getRelationshipIcon } from '@/utils/icon';
import { InternalEventType } from '@/utils/internalEvents';

let mounted: Mounted | null = null;

/**
 * Erd subscribes to the global drag$ on every canvas mousedown, and only a
 * global mouseup completes it. Ending the drag before unmounting keeps a live
 * subscription and the shared movement bookkeeping out of the next test.
 */
afterEach(() => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

type Harness = {
  app: AppContext;
  container: HTMLDivElement;
  root: HTMLDivElement;
  props: {
    isDarkMode: boolean;
    mouseTracking: boolean;
    readonly: boolean;
    enableWelcomeScreen: boolean;
  };
  actions: AnyAction[];
};

async function setup(
  initial: Partial<Harness['props']> = {},
  app: AppContext = createTestAppContext()
): Promise<Harness> {
  const props = observable({
    isDarkMode: false,
    mouseTracking: false,
    readonly: false,
    enableWelcomeScreen: false,
    ...initial,
  });

  // The element binds the keys around this root, which is how a press reaches
  // shortcut$; bound here too, a key a spec presses takes the real path.
  const Wrapper: FC = (_, ctx) => {
    const keys = createRef<HTMLDivElement>();
    useKeyBindingMap(ctx, keys);

    return () =>
      html`<div ${ref(keys)}>
        <${Erd}
          isDarkMode=${props.isDarkMode}
          mouseTracking=${props.mouseTracking}
          readonly=${props.readonly}
          enableWelcomeScreen=${props.enableWelcomeScreen}
        />
      </div>`;
  };

  const actions: AnyAction[] = [];
  app.store.subscribe(dispatched => actions.push(...dispatched));

  mounted = await mountAndFlush(html`<${Wrapper} />`, app);

  const root = mounted.container.querySelector(
    `.${String(styles.root)}`
  ) as HTMLDivElement;

  return { app, container: mounted.container, root, props, actions };
}

/** Two tables far apart, which is what gives the origin travel to scroll over. */
const appWithContent = () => {
  const app = createTestAppContext();
  app.store.dispatchSync(
    addTableAction({ id: 'near', ui: { x: 0, y: 0, zIndex: 2 } })
  );
  app.store.dispatchSync(
    addTableAction({ id: 'far', ui: { x: 2_000, y: 2_000, zIndex: 2 } })
  );
  return app;
};

const seedTable = (app: AppContext, name?: string) => {
  app.store.dispatchSync(addTableAction$());
  const id =
    app.store.state.doc.tableIds[app.store.state.doc.tableIds.length - 1];
  if (name) {
    app.store.dispatchSync(changeTableNameAction({ id, value: name }));
  }
  return id;
};

const ERD_SOURCE = readFileSync(
  join(process.cwd(), 'src', 'components', 'erd', 'Erd.tsx'),
  'utf8'
);

/** Every place the routing asks the event target for an ancestor of one class. */
const routingCalls = (className: string) =>
  ERD_SOURCE.match(
    new RegExp(String.raw`closest\(\s*'\.${className}'\s*\)`, 'g')
  ) ?? [];

/**
 * The overlays that stayed dom when the scene moved onto a canvas. A press
 * inside one of these is still an element the routing can ask an ancestor for,
 * and each is a guard that has to survive the move.
 */
const DOM_GUARDS = [
  'color-picker',
  'edit-overlay',
  'edit-input',
  'context-menu-content',
  'content-compass',
  'floating-toolbar',
  'minimap',
  'minimap-viewport',
  'virtual-scroll',
  'welcome-screen-menu',
];

const dispatchMouse = (
  target: EventTarget,
  type: string,
  init: MouseEventInit = {}
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

/** The modifier $mod resolves to, read off the platform the way hasAppleDevice reads it. */
const MOD = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  ? { metaKey: true }
  : { ctrlKey: true };

const pressKeydown = (
  app: AppContext,
  target: Element,
  code: string,
  init: KeyboardEventInit = {}
) => {
  const forward = (event: Event) => app.keydown$.next(event as KeyboardEvent);
  target.addEventListener('keydown', forward);
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
      ...init,
    })
  );
  target.removeEventListener('keydown', forward);
};

const findByText = (root: ParentNode, selector: string, text: string) =>
  Array.from(root.querySelectorAll(selector)).find(
    el => el.textContent?.trim() === text
  ) as HTMLElement | undefined;

const seedRelationship = (app: AppContext, id: string) => {
  const start = seedTable(app, 'alpha');
  const end = seedTable(app, 'beta');
  app.store.dispatchSync(addColumnAction$(start));
  app.store.dispatchSync(addColumnAction$(end));
  const { tableEntities } = app.store.state.collections;

  app.store.dispatchSync(
    addRelationshipAction({
      id,
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: start, columnIds: [tableEntities[start].columnIds[0]] },
      end: { tableId: end, columnIds: [tableEntities[end].columnIds[0]] },
    })
  );

  return id;
};

/**
 * Where the routing now reads an entity from, which is AC-G15 in both
 * directions: the scene half asks the konva hit test and the overlay half still
 * asks a dom ancestor. What each answer then does is asserted in the browser.
 */
describe('Erd - scene routing', () => {
  it('asks no dom ancestor for a table, a memo or a relationship', () => {
    expect(routingCalls('table')).toEqual([]);
    expect(routingCalls('memo')).toEqual([]);
    expect(routingCalls('relationship')).toEqual([]);
  });

  it('keeps a dom guard for every overlay the scene never drew', () => {
    const guarded = DOM_GUARDS.filter(name => routingCalls(name).length > 0);

    expect(guarded).toEqual(DOM_GUARDS);
  });

  it('reads the scene half through the shared hit test', () => {
    expect(ERD_SOURCE).toMatch(/from '@\/components\/erd\/hitTest'/);
  });

  it('hands that hit test the stage container and not the erd root', () => {
    const calls = ERD_SOURCE.match(/sceneHit\(canvas\.value, event\)/g) ?? [];

    expect(calls).toHaveLength(2);
    expect(ERD_SOURCE).not.toMatch(/sceneHit\(root\./);
  });

  it('draws its entities as no element of its own', async () => {
    const { app, root } = await setup();
    seedRelationship(app, 'rel-scene');
    await flush();

    expect(root.querySelector('.table')).toBeNull();
    expect(root.querySelector('.relationship')).toBeNull();
  });
});

describe('Erd - shell', () => {
  it('renders the canvas shell with the scroll and minimap layers', async () => {
    const { root } = await setup({}, appWithContent());

    expect(root).toBeTruthy();
    expect(root.className).toBe(String(styles.root));
    expect(root.querySelectorAll('.virtual-scroll')).toHaveLength(2);
    expect(root.querySelector('.minimap')).toBeTruthy();
    expect(root.querySelector('.minimap-viewport')).toBeTruthy();
  });

  it('hides the minimap on an empty document, as the scrollbars are, until a table exists', async () => {
    const app = createTestAppContext();
    const { root } = await setup({}, app);

    expect(root.querySelectorAll('.virtual-scroll')).toHaveLength(0);
    expect(root.querySelector('.minimap')).toBeNull();
    expect(root.querySelector('.minimap-viewport')).toBeNull();

    app.store.dispatchSync(
      addTableAction({ id: 'first', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    await flush();

    expect(root.querySelector('.minimap')).toBeTruthy();
    expect(root.querySelector('.minimap-viewport')).toBeTruthy();
  });

  it('draws the compass once the view is panned off every entity, and puts it away on the way back', async () => {
    const app = appWithContent();
    const { root } = await setup({}, app);

    expect(root.querySelector('.content-compass')).toBeNull();

    app.store.dispatchSync(
      scrollToAction({ originX: -9_000, originY: -7_000 })
    );
    await flush();

    expect(root.querySelector('.content-compass')).toBeTruthy();

    app.store.dispatchSync(scrollToAction({ originX: 0, originY: 0 }));
    await flush();

    expect(root.querySelector('.content-compass')).toBeNull();
  });

  it('takes a press on the compass as a jump rather than as the start of a pan', async () => {
    const app = appWithContent();
    const { root } = await setup({}, app);

    app.store.dispatchSync(
      scrollToAction({ originX: -9_000, originY: -7_000 })
    );
    app.store.dispatchSync(changeHandToolAction({ value: true }));
    await flush();

    const pill = root.querySelector('.content-compass') as HTMLElement;
    dispatchMouse(pill, 'mousedown', { clientX: 10, clientY: 10 });
    await flush();

    expect(root.style.cursor).toBe('grab');
  });

  it('draws the floating tools over the canvas, in zen mode as well', async () => {
    const app = appWithContent();
    const { root } = await setup({}, app);

    expect(root.querySelector('.floating-toolbar')).toBeTruthy();

    app.store.dispatchSync(changeZenModeAction({ value: true }));
    await flush();

    expect(root.querySelector('.floating-toolbar')).toBeTruthy();
  });

  it.each([
    ['time travel', Open.timeTravel],
    ['diff viewer', Open.diffViewer],
    ['automatic table placement', Open.automaticTablePlacement],
  ])(
    'takes the floating tools away while the %s is open, and gives them back',
    async (_, overlay) => {
      const app = appWithContent();
      const { root } = await setup({}, app);

      app.store.dispatchSync(changeOpenMapAction({ [overlay]: true }));
      await flush(6);

      expect(root.querySelector('.floating-toolbar')).toBeNull();

      app.store.dispatchSync(changeOpenMapAction({ [overlay]: false }));
      await flush(6);

      expect(root.querySelector('.floating-toolbar')).toBeTruthy();
    }
  );

  it('takes the floating tools away while the table properties are open', async () => {
    const app = appWithContent();
    const { root } = await setup({}, app);

    app.emitter.emit(openTablePropertiesAction({ tableId: 'near' }));
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: true })
    );
    await flush(6);

    expect(root.querySelector('.floating-toolbar')).toBeNull();
  });

  it('takes the scrollbars and the map away in zen mode, and gives them back', async () => {
    const app = appWithContent();
    const { root } = await setup({}, app);

    expect(root.querySelectorAll('.virtual-scroll')).toHaveLength(2);
    expect(root.querySelector('.minimap')).toBeTruthy();

    app.store.dispatchSync(changeZenModeAction({ value: true }));
    await flush();

    expect(root.querySelectorAll('.virtual-scroll')).toHaveLength(0);
    expect(root.querySelector('.minimap')).toBeNull();
    expect(root.querySelector('.minimap-viewport')).toBeNull();

    app.store.dispatchSync(changeZenModeAction({ value: false }));
    await flush();

    expect(root.querySelectorAll('.virtual-scroll')).toHaveLength(2);
    expect(root.querySelector('.minimap')).toBeTruthy();
  });

  it('renders no overlay by default', async () => {
    const { root } = await setup();

    expect(root.querySelector('.color-picker')).toBeNull();
    expect(root.querySelector('.table-properties')).toBeNull();
    expect(root.querySelector('[data-testid="erd-canvas"]')).toBeTruthy();
  });
});

describe('Erd - cursor', () => {
  it('has no cursor override while idle', async () => {
    const { root } = await setup();

    expect(root.style.cursor).toBe('');
  });

  it('shows the relationship icon cursor while drawing a relationship', async () => {
    const { app, root } = await setup();

    app.store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroN,
      })
    );
    await flush();

    const icon = getRelationshipIcon(RelationshipType.ZeroN, false);
    expect(icon).toBeTruthy();
    expect(root.style.cursor).toBe(`url("${icon}") 16 16, auto`);
  });

  it('inks the relationship cursor for the appearance it is drawn on, live', async () => {
    const { app, root, props } = await setup({ isDarkMode: true });

    app.store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroN,
      })
    );
    await flush();

    const dark = getRelationshipIcon(RelationshipType.ZeroN, true);
    const light = getRelationshipIcon(RelationshipType.ZeroN, false);
    expect(dark).not.toBe(light);
    expect(root.style.cursor).toBe(`url("${dark}") 16 16, auto`);

    props.isDarkMode = false;
    await flush();

    expect(root.style.cursor).toBe(`url("${light}") 16 16, auto`);
  });

  it('shows the grab cursor for as long as the hand tool is down', async () => {
    const { app, root } = await setup();

    app.store.dispatchSync(changeHandToolAction({ value: true }));
    await flush();

    expect(root.style.cursor).toBe('grab');

    app.store.dispatchSync(changeHandToolAction({ value: false }));
    await flush();

    expect(root.style.cursor).toBe('');
  });

  it('shows the grabbing cursor while the hand tool drags', async () => {
    const { app, root } = await setup();
    app.store.dispatchSync(changeHandToolAction({ value: true }));
    await flush();

    dispatchMouse(root, 'mousedown', { clientX: 10, clientY: 10 });
    await flush();

    expect(root.style.cursor).toBe('grabbing');

    dispatchMouse(window, 'mouseup');
    await flush();

    expect(root.style.cursor).toBe('grab');
  });
});

describe('Erd - wheel', () => {
  const wheel = (
    target: EventTarget,
    init: WheelEventInit & {
      shiftKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
    }
  ) => {
    const { shiftKey, ctrlKey, metaKey, ...rest } = init;
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ...rest,
    });
    // happy-dom's WheelEvent constructor drops the modifier flags.
    Object.defineProperties(event, {
      shiftKey: { value: Boolean(shiftKey) },
      ctrlKey: { value: Boolean(ctrlKey) },
      metaKey: { value: Boolean(metaKey) },
    });
    target.dispatchEvent(event);
    return event;
  };

  it('scrolls the canvas', async () => {
    const { app, root } = await setup({}, appWithContent());

    const event = wheel(root, { deltaX: 100, deltaY: 50 });
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(app.store.state.settings.originX).toBe(-100);
    expect(app.store.state.settings.originY).toBe(-50);
  });

  it('maps a shift wheel onto the horizontal axis', async () => {
    const { app, root } = await setup({}, appWithContent());

    wheel(root, { deltaX: 0, deltaY: 80, shiftKey: true });
    await flush();

    expect(app.store.state.settings.originX).toBe(-80);
    expect(app.store.state.settings.originY).toBe(0);
  });

  // A whole notch: one short of it under ctrl is a trackpad pinch, below.
  it('zooms out with the modifier key held', async () => {
    const { app, root } = await setup();

    wheel(root, { deltaX: 0, deltaY: 100, ctrlKey: true, metaKey: true });
    await flush();

    expect(app.store.state.settings.zoomLevel).toBe(0.97);
  });

  it('zooms in with the modifier key held', async () => {
    const { app, root } = await setup();
    app.store.state.settings.zoomLevel = 0.8;

    wheel(root, { deltaX: 0, deltaY: -100, ctrlKey: true, metaKey: true });
    await flush();

    expect(app.store.state.settings.zoomLevel).toBe(0.83);
  });

  it('is inert while an overlay is open', async () => {
    const { app, root } = await setup();
    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));
    await flush();

    const event = wheel(root, { deltaX: 100, deltaY: 50 });
    await flush();

    expect(event.defaultPrevented).toBe(false);
    expect(app.store.state.settings.originX).toBe(0);
  });
});

describe('Erd - pinch', () => {
  const POINTER = { x: 300, y: 200 };

  /** A trackpad pinch as a browser sends it: a ctrl wheel of -100 ln(scale). */
  const pinchWheel = (target: EventTarget, scale: number) => {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -100 * Math.log(scale),
    });
    // happy-dom's WheelEvent constructor drops these as it does the modifiers.
    Object.defineProperties(event, {
      ctrlKey: { value: true },
      clientX: { value: POINTER.x },
      clientY: { value: POINTER.y },
    });
    target.dispatchEvent(event);
    return event;
  };

  type Finger = { x: number; y: number };

  const touches = (type: string, fingers: Finger[]) =>
    new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: fingers.map(({ x, y }) => ({ clientX: x, clientY: y })) as any,
    });

  /** The scene point under a screen point, read the way the canon reads it. */
  const sceneUnder = (app: AppContext, { x, y }: Finger) => {
    const { originX, originY, zoomLevel } = app.store.state.settings;
    return { x: (x - originX) / zoomLevel, y: (y - originY) / zoomLevel };
  };

  it('zooms a trackpad pinch about the pointer', async () => {
    const { app, root } = await setup({}, appWithContent());
    app.store.dispatchSync(scrollToAction({ originX: -140, originY: -60 }));
    const anchor = sceneUnder(app, POINTER);

    const event = pinchWheel(root, 1.08);
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(app.store.state.settings.zoomLevel).toBe(1.08);
    expect(sceneUnder(app, POINTER).x).toBeCloseTo(anchor.x, 3);
    expect(sceneUnder(app, POINTER).y).toBeCloseTo(anchor.y, 3);
  });

  it('carries a slow pinch past the rounding of the zoom', async () => {
    const { app, root } = await setup();
    app.store.state.settings.zoomLevel = 0.3;

    // Each is a sixth of a percent, which alone rounds back to 0.3.
    for (let event = 0; event < 30; event++) {
      pinchWheel(root, 1.0017);
      await flush();
    }

    expect(app.store.state.settings.zoomLevel).toBe(0.32);
  });

  it('zooms two fingers about their midpoint and pans as it travels', async () => {
    const { app, root } = await setup({}, appWithContent());
    const midpoint = { x: 200, y: 150 };
    const anchor = sceneUnder(app, midpoint);

    root.dispatchEvent(
      touches('touchstart', [
        { x: 150, y: 150 },
        { x: 250, y: 150 },
      ])
    );
    // In steps, each landing before the next, as a browser delivers them: the
    // scale is from where the pinch began, never from where the last step left it.
    for (const step of [0.25, 0.5, 0.75, 1]) {
      window.dispatchEvent(
        touches('touchmove', [
          { x: 150 + 10 * step, y: 150 + 40 * step },
          { x: 250 - 40 * step, y: 150 + 40 * step },
        ])
      );
      await flush();
    }

    const moved = { x: 185, y: 190 };
    expect(app.store.state.settings.zoomLevel).toBe(0.5);
    expect(sceneUnder(app, moved).x).toBeCloseTo(anchor.x, 3);
    expect(sceneUnder(app, moved).y).toBeCloseTo(anchor.y, 3);
  });

  it('leaves the selection alone for the second finger of a pinch', async () => {
    const { app, root, actions } = await setup({}, appWithContent());
    actions.length = 0;

    root.dispatchEvent(
      touches('touchstart', [
        { x: 150, y: 150 },
        { x: 250, y: 150 },
      ])
    );
    await flush();

    expect(actions).toEqual([]);
    expect(app.store.state.settings.originX).toBe(0);
  });

  it('zooms nothing under an open overlay, and holds the pinch off the page', async () => {
    const { app, root } = await setup();
    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));
    await flush();

    const event = pinchWheel(root, 1.08);
    root.dispatchEvent(
      touches('touchstart', [
        { x: 150, y: 150 },
        { x: 250, y: 150 },
      ])
    );
    window.dispatchEvent(
      touches('touchmove', [
        { x: 100, y: 150 },
        { x: 300, y: 150 },
      ])
    );
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(app.store.state.settings.zoomLevel).toBe(1);
  });
});

describe('Erd - context menu', () => {
  const openContextMenu = async (target: Element) => {
    dispatchMouse(target, 'contextmenu', { clientX: 12, clientY: 24 });
    await flush(6);
  };

  it('opens the ERD context menu on the empty canvas', async () => {
    const { root } = await setup();

    await openContextMenu(root);

    expect(findByText(root, 'div', 'New Table')).toBeTruthy();
    expect(findByText(root, 'div', 'Auto Layout')).toBeTruthy();
  });

  it('opens the erd context menu where the scene answers with no entity', async () => {
    const { app, root } = await setup();
    seedRelationship(app, 'rel-1');
    await flush();

    await openContextMenu(root);

    expect(findByText(root, 'div', 'New Table')).toBeTruthy();
    expect(findByText(root, 'div', 'Table Properties')).toBeUndefined();
    expect(findByText(root, 'div', 'Relationship Type')).toBeUndefined();
  });

  it('closes the context menu when a menu item is chosen', async () => {
    const { app, root } = await setup();
    await openContextMenu(root);

    const newTable = findByText(root, 'div', 'New Table')!;
    dispatchMouse(newTable, 'click');
    await flush(6);

    expect(findByText(root, 'div', 'New Table')).toBeUndefined();
    expect(app.store.state.doc.tableIds).toHaveLength(1);
  });

  it('does not open while an overlay is open', async () => {
    const { app, root } = await setup();
    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));
    await flush();

    await openContextMenu(root);

    expect(findByText(root, 'div', 'New Table')).toBeUndefined();
  });
});

describe('Erd - drag select and grab move', () => {
  it('hands the marquee its origin and its scene on a modifier mousedown', async () => {
    const { app, root } = await setup();
    const dragSelectStart = vi.fn();
    app.emitter.on({ dragSelectStart });

    const event = dispatchMouse(root, 'mousedown', {
      clientX: 40,
      clientY: 60,
      ctrlKey: true,
      metaKey: true,
    });
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(dragSelectStart).toHaveBeenCalledWith({
      type: 'dragSelectStart',
      payload: { x: 40, y: 60, source: 'document' },
    });
  });

  it('never pans while the marquee owns the modifier drag', async () => {
    const { app, root } = await setup();

    dispatchMouse(root, 'mousedown', {
      clientX: 40,
      clientY: 60,
      ctrlKey: true,
      metaKey: true,
    });
    dispatchMouse(window, 'mousemove', { clientX: 140, clientY: 160 });
    await flush();

    const { originX, originY } = app.store.state.settings;
    expect([originX, originY]).toEqual([0, 0]);
  });

  it('unselects everything and hides the color picker on a canvas mousedown', async () => {
    const { app, root } = await setup();
    seedTable(app);
    app.emitter.emit(openColorPickerAction({ x: 20, y: 30, color: '#ffffff' }));
    await flush();
    expect(root.querySelector('.color-picker')).toBeTruthy();

    dispatchMouse(root, 'mousedown', { clientX: 5, clientY: 5 });
    await flush();

    expect(app.store.state.editor.selectedMap).toEqual({});
    expect(root.querySelector('.color-picker')).toBeNull();
  });

  it('scrolls the canvas while dragging', async () => {
    const { app, root } = await setup({}, appWithContent());

    dispatchMouse(root, 'mousedown', { clientX: 100, clientY: 100 });
    const move = dispatchMouse(window, 'mousemove', {
      clientX: 60,
      clientY: 70,
    });
    await flush();

    expect(move.defaultPrevented).toBe(true);
    expect(app.store.state.settings.originX).toBe(-40);
    expect(app.store.state.settings.originY).toBe(-30);

    dispatchMouse(window, 'mouseup');
  });

  it('ignores a drag move that did not move', async () => {
    const { app, root } = await setup();

    dispatchMouse(root, 'mousedown', { clientX: 100, clientY: 100 });
    dispatchMouse(window, 'mousemove', { clientX: 100, clientY: 100 });
    await flush();

    expect(app.store.state.settings.originX).toBe(0);
    dispatchMouse(window, 'mouseup');
  });

  it('resets the native scroll offsets that the drag introduced', async () => {
    const { root } = await setup();
    root.scrollTop = 25;
    root.scrollLeft = 35;

    dispatchMouse(root, 'mousedown', { clientX: 100, clientY: 100 });
    dispatchMouse(window, 'mousemove', { clientX: 90, clientY: 90 });
    await flush();

    expect(root.scrollTop).toBe(0);
    expect(root.scrollLeft).toBe(0);
    dispatchMouse(window, 'mouseup');
  });

  it('leaves the scroll alone when a drag move arrives after the canvas ref is gone', async () => {
    const errors: unknown[] = [];
    const onUnhandledError = rxjsConfig.onUnhandledError;
    rxjsConfig.onUnhandledError = error => errors.push(error);

    try {
      const { root } = await setup();
      root.scrollTop = 25;
      root.scrollLeft = 35;

      dispatchMouse(root, 'mousedown', { clientX: 100, clientY: 100 });
      mounted?.unmount();
      mounted = null;

      dispatchMouse(window, 'mousemove', { clientX: 90, clientY: 90 });
      await flush();
      // rxjs reports subscriber errors on a macrotask, so let one elapse.
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(errors).toEqual([]);
      expect(root.scrollTop).toBe(25);
      expect(root.scrollLeft).toBe(35);
    } finally {
      rxjsConfig.onUnhandledError = onUnhandledError;
      dispatchMouse(window, 'mouseup');
    }
  });

  it('does not drag select while an overlay is open', async () => {
    const { app, root } = await setup();
    const dragSelectStart = vi.fn();
    app.emitter.on({ dragSelectStart });
    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));
    await flush();

    dispatchMouse(root, 'mousedown', {
      clientX: 40,
      clientY: 60,
      ctrlKey: true,
      metaKey: true,
    });
    await flush();

    expect(dragSelectStart).not.toHaveBeenCalled();
  });
});

describe('Erd - color picker', () => {
  const pickerOf = (root: HTMLElement) =>
    root.querySelector('.color-picker') as HTMLElement | null;

  const hexOf = (root: HTMLElement) =>
    root.querySelector(
      '.color-picker input[aria-label="Hex"]'
    ) as HTMLInputElement;

  /** Types a whole hex into the open picker's Hex field, which applies it as typed. */
  const typeHex = async (root: HTMLElement, text: string) => {
    const hex = hexOf(root);
    hex.value = text;
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
  };

  const openPicker = async (app: AppContext, color = '#ffffff') => {
    app.emitter.emit(openColorPickerAction({ x: 10, y: 10, color }));
    await flush();
  };

  it('positions the color picker where the emitter asked for it', async () => {
    const { app, root } = await setup();

    app.emitter.emit(openColorPickerAction({ x: 40, y: 50, color: '#ff0000' }));
    await flush();

    const picker = pickerOf(root) as HTMLElement;
    expect(picker.style.left).toBe('40px');
    expect(picker.style.top).toBe('50px');
  });

  it('applies the picked color to every selected table', async () => {
    const { app, root } = await setup();
    const tableId = seedTable(app);
    await openPicker(app);

    await typeHex(root, '123456');

    const table = app.store.state.collections.tableEntities[tableId];
    expect(table.ui.color).toBe('#123456');
    expect(pickerOf(root)).toBeTruthy();
  });

  it('clears the selection color on No color, closes and hands the focus back', async () => {
    const { app, root } = await setup();
    const tableId = seedTable(app);
    await openPicker(app);
    await typeHex(root, '123456');
    const onFocus = vi.fn();
    document.body.addEventListener(InternalEventType.focus, onFocus);

    try {
      const button = findByText(root, '.color-picker button', 'No color');
      button!.click();
      await flush();

      expect(app.store.state.collections.tableEntities[tableId].ui.color).toBe(
        ''
      );
      expect(pickerOf(root)).toBeNull();
      expect(onFocus).toHaveBeenCalledTimes(1);
    } finally {
      document.body.removeEventListener(InternalEventType.focus, onFocus);
    }
  });

  it('offers the colors the document holds, the most used first', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } }),
      addTableAction({ id: 't2', ui: { x: 400, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'm1', ui: { x: 0, y: 400, zIndex: 2 } }),
      changeTableColorAction({ id: 't1', color: '#ff0000', prevColor: '' }),
      changeTableColorAction({ id: 't2', color: '#00ff00', prevColor: '' }),
      changeMemoColorAction({ id: 'm1', color: '#00ff00', prevColor: '' })
    );
    const { root } = await setup({}, app);
    await openPicker(app);

    const swatches = Array.from(
      root.querySelectorAll(
        '.color-picker [role="radiogroup"][aria-label="Document colors"] [role="radio"]'
      )
    ).map(swatch => swatch.getAttribute('aria-label'));

    expect(swatches).toEqual(['#00FF00', '#FF0000']);
  });

  it('closes on an Escape pressed inside it and keeps the selection', async () => {
    const { app, root } = await setup();
    const tableId = seedTable(app);
    await openPicker(app);

    const panel = root.querySelector(
      '.color-picker [role="dialog"]'
    ) as HTMLElement;
    panel.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );
    await flush();

    expect(pickerOf(root)).toBeNull();
    expect(app.store.state.editor.selectedMap).toEqual({
      [tableId]: expect.anything(),
    });
  });

  it('closes on an Escape the canvas hears, which also unselects', async () => {
    const { app, root } = await setup();
    seedTable(app);
    await openPicker(app);

    pressKeydown(app, root, 'Escape');
    await flush();

    expect(pickerOf(root)).toBeNull();
    expect(app.store.state.editor.selectedMap).toEqual({});
  });

  it('leaves that Escape to the palette, a cell editor or a relationship draw, which take it first', async () => {
    const { app, root } = await setup();
    const tableId = seedTable(app);
    await openPicker(app);

    app.store.dispatchSync(changeOpenMapAction({ [Open.search]: true }));
    pressKeydown(app, root, 'Escape');
    await flush();
    expect(pickerOf(root)).toBeTruthy();

    app.store.dispatchSync(
      changeOpenMapAction({ [Open.search]: false }),
      focusTableAction({ tableId }),
      editTableAction()
    );
    pressKeydown(app, root, 'Escape');
    await flush();
    expect(pickerOf(root)).toBeTruthy();

    app.store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.ZeroN })
    );
    pressKeydown(app, root, 'Escape');
    await flush();
    expect(app.store.state.editor.drawRelationship).toBeNull();
    expect(pickerOf(root)).toBeTruthy();
  });

  it.each([
    ['Delete', 'Delete', {}],
    ['$mod+Backspace', 'Backspace', { key: 'Backspace', ...MOD }],
    ['$mod+Delete', 'Delete', { key: 'Delete', ...MOD }],
  ] as const)(
    'closes on %s, which takes away what it paints',
    async (_, code, init) => {
      const { app, root } = await setup();
      const tableId = seedTable(app);
      await openPicker(app);

      pressKeydown(app, root, code, init);
      await flush();

      expect(app.store.state.doc.tableIds).not.toContain(tableId);
      expect(pickerOf(root)).toBeNull();
    }
  );

  it('stays open for the undo key', async () => {
    const { app, root } = await setup();
    const tableId = seedTable(app);
    await openPicker(app);

    pressKeydown(app, root, 'KeyZ', { key: 'z', ...MOD });
    await flush();

    expect(app.store.state.doc.tableIds).not.toContain(tableId);
    expect(pickerOf(root)).toBeTruthy();
  });

  it('mounts again on the new color when opened while it is open', async () => {
    const { app, root } = await setup();
    await openPicker(app, '#ff0000');
    const panel = root.querySelector('.color-picker [role="dialog"]');
    expect(hexOf(root).value).toBe('FF0000');

    await openPicker(app, '#00ff00');

    expect(hexOf(root).value).toBe('00FF00');
    expect(root.querySelector('.color-picker [role="dialog"]')).not.toBe(panel);
    expect(root.querySelectorAll('.color-picker')).toHaveLength(1);
  });
});

describe('Erd - table properties', () => {
  const tabTitles = (root: HTMLElement) =>
    Array.from(
      root.querySelectorAll(`.${String(tablePropertiesStyles.tableChip)}`)
    ).map(el => el.getAttribute('title'));

  const openTableProperties = async (app: AppContext, tableId: string) => {
    app.emitter.emit(openTablePropertiesAction({ tableId }));
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: true })
    );
    await flush(6);
  };

  it('renders the panel for the requested table', async () => {
    const { app, root } = await setup();
    const tableId = seedTable(app, 'alpha');
    await openTableProperties(app, tableId);

    const tab = root.querySelector('[title="alpha"]') as HTMLElement;
    expect(tab).toBeTruthy();
    expect(tab.className).toContain('selected');
  });

  it('keeps the most recent tables first and de-duplicates them', async () => {
    const { app, root } = await setup();
    const alpha = seedTable(app, 'alpha');
    const beta = seedTable(app, 'beta');

    await openTableProperties(app, alpha);
    await openTableProperties(app, beta);
    await openTableProperties(app, alpha);

    expect(tabTitles(root)).toEqual(['alpha', 'beta']);
  });

  it('switches the active table when another tab is clicked', async () => {
    const { app, root } = await setup();
    const alpha = seedTable(app, 'alpha');
    const beta = seedTable(app, 'beta');

    await openTableProperties(app, alpha);
    await openTableProperties(app, beta);

    const alphaTab = root.querySelector('[title="alpha"]') as HTMLElement;
    expect(alphaTab.className).not.toContain('selected');

    dispatchMouse(alphaTab, 'click');
    await flush(6);

    expect(
      (root.querySelector('[title="alpha"]') as HTMLElement).className
    ).toContain('selected');
  });

  it('hands the editor readonly mode to the panel', async () => {
    const { app, root, props } = await setup({ readonly: true });
    const tableId = seedTable(app, 'alpha');
    await openTableProperties(app, tableId);

    expect(
      root.querySelector(`.${String(tablePropertiesStyles.readonlyBadge)}`)
    ).toBeTruthy();
    expect(root.querySelector('[title="Add Index"]')).toBeNull();

    props.readonly = false;
    await flush(6);

    expect(
      root.querySelector(`.${String(tablePropertiesStyles.readonlyBadge)}`)
    ).toBeNull();
    expect(root.querySelector('[title="Add Index"]')).toBeTruthy();
  });

  it('drops table ids that no longer exist in the document', async () => {
    const { app, root } = await setup();
    const alpha = seedTable(app, 'alpha');
    const beta = seedTable(app, 'beta');

    await openTableProperties(app, alpha);
    app.store.state.doc.tableIds = app.store.state.doc.tableIds.filter(
      id => id !== alpha
    );
    await openTableProperties(app, beta);

    expect(tabTitles(root)).toEqual(['beta']);
  });
});

describe('Erd - diff viewer', () => {
  it('opens the diff viewer with the emitted document', async () => {
    const { app, root } = await setup();

    app.emitter.emit(openDiffViewerAction({ value: '{}' }));
    await flush(6);

    expect(app.store.state.editor.openMap[Open.diffViewer]).toBe(true);
    expect(root.querySelector('.diff-viewer-insert')).toBeTruthy();
  });

  it('closes the diff viewer and resets the stored document', async () => {
    const { app, root } = await setup();
    app.emitter.emit(openDiffViewerAction({ value: '{}' }));
    await flush(6);

    app.shortcut$.next({
      type: 'stop' as any,
      event: new KeyboardEvent('keydown'),
    });
    await flush(6);

    expect(app.store.state.editor.openMap[Open.diffViewer]).toBe(false);
    expect(root.querySelector('.diff-viewer-insert')).toBeNull();
  });
});

describe('Erd - time travel', () => {
  function createFakeHistory(cursor: number, cloneCursor: number) {
    const undo = vi.fn(() => {
      current -= 1;
    });
    const redo = vi.fn(() => {
      current += 1;
    });
    let current = cursor;

    const clone: History = {
      get cursor() {
        return cloneCursor;
      },
      get size() {
        return 5;
      },
      hasUndo: () => true,
      hasRedo: () => true,
      undo: vi.fn(),
      redo: vi.fn(),
      push: vi.fn(),
      clear: vi.fn(),
      setLimit: vi.fn(),
      clone: () => clone,
    };

    const history: History = {
      get cursor() {
        return current;
      },
      get size() {
        return 5;
      },
      hasUndo: () => true,
      hasRedo: () => true,
      undo,
      redo,
      push: vi.fn(),
      clear: vi.fn(),
      setLimit: vi.fn(),
      clone: () => clone,
    };

    return { history, undo, redo };
  }

  const openTimeTravel = async (app: AppContext) => {
    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));
    await flush(6);
  };

  it('replays history forward when the applied cursor is ahead', async () => {
    const { history, redo, undo } = createFakeHistory(0, 3);
    const { app, root } = await setup(
      {},
      createTestAppContext({ getHistory: () => history })
    );
    await openTimeTravel(app);

    const apply = findByText(root, 'button', 'Apply')!;
    expect(apply).toBeTruthy();
    dispatchMouse(apply, 'click');
    await flush(6);

    expect(redo).toHaveBeenCalledTimes(3);
    expect(undo).not.toHaveBeenCalled();
    expect(app.store.state.editor.openMap[Open.timeTravel]).toBe(false);
  });

  it('rewinds history when the applied cursor is behind', async () => {
    const { history, redo, undo } = createFakeHistory(2, -1);
    const { app, root } = await setup(
      {},
      createTestAppContext({ getHistory: () => history })
    );
    await openTimeTravel(app);

    dispatchMouse(findByText(root, 'button', 'Apply')!, 'click');
    await flush(6);

    expect(undo).toHaveBeenCalledTimes(3);
    expect(redo).not.toHaveBeenCalled();
  });

  it('closes without touching history when cancelled', async () => {
    const { history, redo, undo } = createFakeHistory(0, 3);
    const { app, root } = await setup(
      {},
      createTestAppContext({ getHistory: () => history })
    );
    await openTimeTravel(app);

    dispatchMouse(findByText(root, 'button', 'Cancel')!, 'click');
    await flush(6);

    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    expect(app.store.state.editor.openMap[Open.timeTravel]).toBe(false);
  });
});

describe('Erd - automatic table placement', () => {
  const middleOf = ({ x, y, width, height }: Rect) => ({
    x: x + width / 2,
    y: y + height / 2,
  });

  it('moves the tables to the positions the simulation produced', async () => {
    const { app, actions } = await setup();
    seedTable(app, 'alpha');
    seedTable(app, 'beta');
    await flush();

    const toasts: any[] = [];
    app.emitter.on({
      openToast: ({ payload: { message } }) => {
        toasts.push(message);
      },
    });

    app.store.dispatchSync(
      changeOpenMapAction({ [Open.automaticTablePlacement]: true })
    );
    await flush(6);

    expect(toasts).toHaveLength(1);
    const toast = mount(toasts[0], app);
    await flush();

    const apply = findByText(toast.container, 'button', 'Apply')!;
    expect(apply).toBeTruthy();
    actions.length = 0;
    dispatchMouse(apply, 'click');
    await flush(6);

    expect(actions.map(action => action.type)).toContain(
      moveToTableAction.type
    );
    expect(app.store.state.editor.openMap[Open.automaticTablePlacement]).toBe(
      false
    );
    toast.unmount();
  });

  it('centres the view on where the placement left the tables', async () => {
    const { app } = await setup();
    seedTable(app, 'alpha');
    seedTable(app, 'beta');
    await flush();

    const toasts: any[] = [];
    app.emitter.on({
      openToast: ({ payload: { message } }) => {
        toasts.push(message);
      },
    });

    app.store.dispatchSync(
      changeOpenMapAction({ [Open.automaticTablePlacement]: true })
    );
    await flush(6);
    const toast = mount(toasts[0], app);
    await flush();

    dispatchMouse(findByText(toast.container, 'button', 'Apply')!, 'click');
    await flush(6);

    // Wherever the simulation left them, the screen is centred on the box they
    // now occupy: the placement is applied to the document and to the view.
    const content = middleOf(getContentRect(app.store.state)!);
    const visible = middleOf(
      getVisibleCanvasRect(getViewTransform(app.store.state))
    );

    expect(visible.x).toBeCloseTo(content.x, 6);
    expect(visible.y).toBeCloseTo(content.y, 6);
    toast.unmount();
  });

  /**
   * The moves and the re-centre are one dispatch, so the history holds them as
   * one entry: a single undo puts every table and the view back where they
   * were, where two entries would leave the tables placed and only the view undone.
   */
  it('undoes the placement and the re-centre together, in one step', async () => {
    const { app } = await setup();
    seedTable(app, 'alpha');
    seedTable(app, 'beta');
    await flush();

    const positionsOf = () =>
      app.store.state.doc.tableIds.map(id => {
        const { x, y } = app.store.state.collections.tableEntities[id].ui;
        return [id, x, y];
      });
    const originOf = () => {
      const { originX, originY } = app.store.state.settings;
      return { x: originX, y: originY };
    };
    const before = {
      positions: positionsOf(),
      origin: originOf(),
      cursor: app.store.history.cursor,
    };

    const toasts: any[] = [];
    app.emitter.on({
      openToast: ({ payload: { message } }) => {
        toasts.push(message);
      },
    });

    app.store.dispatchSync(
      changeOpenMapAction({ [Open.automaticTablePlacement]: true })
    );
    await flush(6);
    const toast = mount(toasts[0], app);
    await flush();

    // Let the simulation tick before applying: a tick rewrites every position
    // in the preview, which is what gives the undo below something to put back.
    await vi.waitFor(() => {
      const percent = /(\d+)%/.exec(toast.container.textContent ?? '')?.[1];
      expect(Number(percent)).toBeGreaterThan(0);
    });

    dispatchMouse(findByText(toast.container, 'button', 'Apply')!, 'click');
    await flush(6);

    expect(positionsOf()).not.toEqual(before.positions);
    expect(originOf()).not.toEqual(before.origin);
    expect(app.store.history.cursor).toBe(before.cursor + 1);

    app.store.undo();
    await flush(6);

    expect(positionsOf()).toEqual(before.positions);
    expect(originOf()).toEqual(before.origin);
    expect(app.store.history.cursor).toBe(before.cursor);
    toast.unmount();
  });
});

describe('Erd - shared mouse tracking', () => {
  const trackerActions = (actions: AnyAction[]) =>
    actions.filter(action => action.type === sharedMouseTrackerAction.type);

  it('publishes the pointer position while mouse tracking is on', async () => {
    const { root, actions } = await setup({ mouseTracking: true });

    dispatchMouse(root, 'mousemove', { clientX: 120, clientY: 140 });
    await new Promise(resolve => setTimeout(resolve, 150));
    await flush();

    expect(trackerActions(actions).length).toBeGreaterThan(0);
  });

  it('does not publish while mouse tracking is off', async () => {
    const { root, actions } = await setup();

    dispatchMouse(root, 'mousemove', { clientX: 120, clientY: 140 });
    await new Promise(resolve => setTimeout(resolve, 150));
    await flush();

    expect(trackerActions(actions)).toHaveLength(0);
  });

  it('starts and stops tracking as the prop changes', async () => {
    const { root, props, actions } = await setup();

    props.mouseTracking = true;
    await flush();
    dispatchMouse(root, 'mousemove', { clientX: 10, clientY: 20 });
    await new Promise(resolve => setTimeout(resolve, 150));
    await flush();
    const started = trackerActions(actions).length;
    expect(started).toBeGreaterThan(0);

    props.mouseTracking = false;
    await flush();
    dispatchMouse(root, 'mousemove', { clientX: 30, clientY: 40 });
    await new Promise(resolve => setTimeout(resolve, 150));
    await flush();

    expect(trackerActions(actions)).toHaveLength(started);
  });

  it('ignores prop changes that are not mouse tracking', async () => {
    const { root, props, actions } = await setup();

    props.isDarkMode = true;
    await flush();
    dispatchMouse(root, 'mousemove', { clientX: 10, clientY: 20 });
    await new Promise(resolve => setTimeout(resolve, 150));
    await flush();

    expect(trackerActions(actions)).toHaveLength(0);
  });
});

describe('Erd - welcome screen', () => {
  const welcome = (root: HTMLElement) => root.querySelector('.welcome-screen');

  const row = (root: HTMLElement, label: string) =>
    Array.from(
      root.querySelectorAll<HTMLButtonElement>('.welcome-screen-item')
    ).find(
      button => button.querySelector('span')?.textContent?.trim() === label
    ) as HTMLButtonElement;

  it('stays off until the host asks for it, then stands over the empty document', async () => {
    const { root, props } = await setup();
    expect(welcome(root)).toBeNull();

    props.enableWelcomeScreen = true;
    await flush();

    expect(welcome(root)).not.toBeNull();
    expect(row(root, 'New Table')).toBeTruthy();
  });

  it.each<[string, (harness: Harness) => void]>([
    [
      'in a read-only editor',
      ({ props }) => {
        props.readonly = true;
      },
    ],
    [
      'in zen mode',
      ({ app }) => app.store.dispatchSync(changeZenModeAction({ value: true })),
    ],
    [
      'under a takeover',
      ({ app }) =>
        app.store.dispatchSync(
          changeOpenMapAction({ [Open.timeTravel]: true })
        ),
    ],
    ['over a table', ({ app }) => seedTable(app)],
    [
      'over a memo',
      ({ app }) =>
        app.store.dispatchSync(
          addMemoAction({ id: 'note', ui: { x: 0, y: 0, zIndex: 2 } })
        ),
    ],
  ])('steps aside %s', async (_, change) => {
    const harness = await setup({ enableWelcomeScreen: true });
    expect(welcome(harness.root)).not.toBeNull();

    change(harness);
    await flush(6);

    expect(welcome(harness.root)).toBeNull();
  });

  it('goes with the first table its menu adds and comes back on the undo', async () => {
    const { app, root } = await setup({ enableWelcomeScreen: true });

    row(root, 'New Table').click();
    await flush(6);

    expect(app.store.state.doc.tableIds).toHaveLength(1);
    expect(welcome(root)).toBeNull();

    app.store.undo();
    await flush(6);

    expect(app.store.state.doc.tableIds).toHaveLength(0);
    expect(welcome(root)).not.toBeNull();
  });

  it('starts no pan on a press on a menu row, while one on the heading pans', async () => {
    const { app, root } = await setup({ enableWelcomeScreen: true });
    const origin = () => {
      const { originX, originY } = app.store.state.settings;
      return [originX, originY];
    };

    dispatchMouse(row(root, 'New Memo'), 'mousedown', {
      clientX: 100,
      clientY: 100,
    });
    dispatchMouse(window, 'mousemove', { clientX: 60, clientY: 70 });
    dispatchMouse(window, 'mouseup');
    await flush();

    expect(origin()).toEqual([0, 0]);

    dispatchMouse(root.querySelector('.welcome-screen-heading')!, 'mousedown', {
      clientX: 100,
      clientY: 100,
    });
    dispatchMouse(window, 'mousemove', { clientX: 60, clientY: 70 });
    dispatchMouse(window, 'mouseup');
    await flush();

    expect(origin()).toEqual([-40, -30]);
  });

  it('zooms on a modifier wheel over the menu', async () => {
    const { app, root } = await setup({ enableWelcomeScreen: true });
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
    });
    // happy-dom's WheelEvent constructor drops the modifier flags.
    Object.defineProperties(event, {
      ctrlKey: { value: true },
      metaKey: { value: true },
    });

    root.querySelector('.welcome-screen-menu')!.dispatchEvent(event);
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(app.store.state.settings.zoomLevel).toBe(0.97);
  });
});
