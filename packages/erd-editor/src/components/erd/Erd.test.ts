import { AnyAction, FC, html, observable } from '@dineug/r-html';
import { config as rxjsConfig } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTestAppContext,
  flush,
  mount,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as dragSelectStyles from '@/components/erd/drag-select/DragSelect.styles';
import Erd from '@/components/erd/Erd';
import * as styles from '@/components/erd/Erd.styles';
import * as tablePropertiesStyles from '@/components/erd/table-properties/TableProperties.styles';
import { Open } from '@/constants/open';
import { CanvasType, RelationshipType } from '@/constants/schema';
import { History } from '@/engine/history';
import {
  changeOpenMapAction,
  drawStartRelationshipAction,
  sharedMouseTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  changeTableNameAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import {
  openColorPickerAction,
  openDiffViewerAction,
  openTablePropertiesAction,
} from '@/utils/emitter';
import { getRelationshipIcon } from '@/utils/icon';

const colorPicker = vi.hoisted(() => {
  const instances: Array<{ options: any; destroy: () => void }> = [];
  const create = vi.fn((options: any) => {
    const el = document.createElement('div');
    el.className = 'mock-colorpicker';
    options.container.appendChild(el);
    const instance = { options, destroy: vi.fn(), $root: { el } };
    instances.push(instance);
    return instance;
  });
  return { instances, create };
});

vi.mock('@easylogic/colorpicker', () => ({
  default: { create: colorPicker.create },
}));

let mounted: Mounted | null = null;

/**
 * `Erd` subscribes to the global `drag$` on every canvas mousedown, and only a
 * global mouseup/touchend completes that subscription. Ending the drag before
 * unmounting keeps one test from leaking a live subscription (and the shared
 * movement bookkeeping) into the next one.
 */
afterEach(() => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  mounted?.unmount();
  mounted = null;
  colorPicker.instances.length = 0;
  vi.restoreAllMocks();
});

type Harness = {
  app: AppContext;
  container: HTMLDivElement;
  root: HTMLDivElement;
  props: { isDarkMode: boolean; mouseTracking: boolean };
  actions: AnyAction[];
};

async function setup(
  initial: Partial<Harness['props']> = {},
  app: AppContext = createTestAppContext()
): Promise<Harness> {
  const props = observable({
    isDarkMode: false,
    mouseTracking: false,
    ...initial,
  });

  const Wrapper: FC = () => () =>
    html`<${Erd}
      isDarkMode=${props.isDarkMode}
      mouseTracking=${props.mouseTracking}
    />`;

  const actions: AnyAction[] = [];
  app.store.subscribe(dispatched => actions.push(...dispatched));

  mounted = await mountAndFlush(html`<${Wrapper} />`, app);

  const root = mounted.container.querySelector(
    `.${String(styles.root)}`
  ) as HTMLDivElement;

  return { app, container: mounted.container, root, props, actions };
}

const seedTable = (app: AppContext, name?: string) => {
  app.store.dispatchSync(addTableAction$());
  const id =
    app.store.state.doc.tableIds[app.store.state.doc.tableIds.length - 1];
  if (name) {
    app.store.dispatchSync(changeTableNameAction({ id, value: name }));
  }
  return id;
};

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

const pressKeydown = (app: AppContext, target: Element, code: string) => {
  const forward = (event: Event) => app.keydown$.next(event as KeyboardEvent);
  target.addEventListener('keydown', forward);
  target.dispatchEvent(
    new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true })
  );
  target.removeEventListener('keydown', forward);
};

const findByText = (root: ParentNode, selector: string, text: string) =>
  Array.from(root.querySelectorAll(selector)).find(
    el => el.textContent?.trim() === text
  ) as HTMLElement | undefined;

describe('Erd - shell', () => {
  it('renders the canvas shell with the scroll, minimap and hide sign layers', async () => {
    const { root } = await setup();

    expect(root).toBeTruthy();
    expect(root.className).toBe(String(styles.root));
    expect(root.querySelectorAll('.virtual-scroll')).toHaveLength(2);
    expect(root.querySelector('.minimap')).toBeTruthy();
    expect(root.querySelector('.minimap-viewport')).toBeTruthy();
  });

  it('renders no overlay by default', async () => {
    const { root } = await setup();

    expect(root.querySelector('.color-picker')).toBeNull();
    expect(root.querySelector('.table-properties')).toBeNull();
    expect(root.querySelector('svg[class]')).toBeTruthy();
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

    const icon = getRelationshipIcon(RelationshipType.ZeroN);
    expect(icon).toBeTruthy();
    expect(root.style.cursor).toBe(`url("${icon}") 16 16, auto`);
  });

  it('switches to the grab cursor while space is held on the canvas', async () => {
    const { app, root } = await setup();

    pressKeydown(app, root, 'Space');
    await flush();

    expect(root.style.cursor).toBe('grab');

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    await flush();

    expect(root.style.cursor).toBe('');
  });

  it('ignores space when the keydown target is not a div', async () => {
    const { app, root } = await setup();
    const span = document.createElement('span');
    root.append(span);

    pressKeydown(app, span, 'Space');
    await flush();

    expect(root.style.cursor).toBe('');
    span.remove();
  });

  it('ignores space when the canvas type is not the ERD canvas', async () => {
    const { app, root } = await setup();
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );

    pressKeydown(app, root, 'Space');
    await flush();

    expect(root.style.cursor).toBe('');
  });

  it('ignores space while an overlay is open', async () => {
    const { app, root } = await setup();
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: true })
    );
    await flush();

    pressKeydown(app, root, 'Space');
    await flush();

    expect(root.style.cursor).toBe('');
  });

  it('shows the grabbing cursor while dragging with space held', async () => {
    const { app, root } = await setup();
    pressKeydown(app, root, 'Space');
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
    const { app, root } = await setup();

    const event = wheel(root, { deltaX: 100, deltaY: 50 });
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(app.store.state.settings.scrollLeft).toBe(-100);
    expect(app.store.state.settings.scrollTop).toBe(-50);
  });

  it('maps a shift wheel onto the horizontal axis', async () => {
    const { app, root } = await setup();

    wheel(root, { deltaX: 0, deltaY: 80, shiftKey: true });
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(-80);
    expect(app.store.state.settings.scrollTop).toBe(0);
  });

  it('zooms out with the modifier key held', async () => {
    const { app, root } = await setup();

    wheel(root, { deltaX: 0, deltaY: 10, ctrlKey: true, metaKey: true });
    await flush();

    expect(app.store.state.settings.zoomLevel).toBe(0.97);
  });

  it('zooms in with the modifier key held', async () => {
    const { app, root } = await setup();
    app.store.state.settings.zoomLevel = 0.8;

    wheel(root, { deltaX: 0, deltaY: -10, ctrlKey: true, metaKey: true });
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
    expect(app.store.state.settings.scrollLeft).toBe(0);
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
    expect(findByText(root, 'div', 'Automatic Table Placement')).toBeTruthy();
  });

  it('opens the table context menu when the target is a table', async () => {
    const { app, root } = await setup();
    const tableId = seedTable(app);
    await flush();

    const table = root.querySelector('.table[data-id]') as HTMLElement;
    expect(table.dataset.id).toBe(tableId);

    await openContextMenu(table);

    expect(findByText(root, 'div', 'Table Properties')).toBeTruthy();
    expect(findByText(root, 'div', 'New Table')).toBeUndefined();
  });

  it('opens the relationship context menu when the target is a relationship', async () => {
    const { app, root } = await setup();
    const start = seedTable(app, 'alpha');
    const end = seedTable(app, 'beta');
    app.store.dispatchSync(addColumnAction$(start));
    app.store.dispatchSync(addColumnAction$(end));
    const startColumnId =
      app.store.state.collections.tableEntities[start].columnIds[0];
    const endColumnId =
      app.store.state.collections.tableEntities[end].columnIds[0];
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'rel-1',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: start, columnIds: [startColumnId] },
        end: { tableId: end, columnIds: [endColumnId] },
      })
    );
    await flush();

    const relationship = root.querySelector(
      '.relationship[data-id]'
    ) as SVGGElement;
    expect(relationship).toBeTruthy();
    expect(relationship.dataset.id).toBe('rel-1');

    await openContextMenu(relationship);

    expect(findByText(root, 'div', 'Relationship Type')).toBeTruthy();
    expect(findByText(root, 'div', 'Delete')).toBeTruthy();
    expect(findByText(root, 'div', 'New Table')).toBeUndefined();
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
  const dragSelectSelector = `svg.${String(dragSelectStyles.dragSelect)}`;

  it('opens the drag select rectangle on a modifier mousedown', async () => {
    const { root } = await setup();

    const event = dispatchMouse(root, 'mousedown', {
      clientX: 40,
      clientY: 60,
      ctrlKey: true,
      metaKey: true,
    });
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(root.querySelector(dragSelectSelector)).toBeTruthy();

    dispatchMouse(root, 'mousemove', { clientX: 100, clientY: 160 });
    await flush();

    const rect = root.querySelector(dragSelectSelector) as SVGElement;
    expect(rect.style.left).toBe('40px');
    expect(rect.style.top).toBe('60px');
    expect(rect.style.width).toBe('60px');
    expect(rect.style.height).toBe('100px');

    dispatchMouse(window, 'mouseup');
    await flush();

    expect(root.querySelector(dragSelectSelector)).toBeNull();
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

  it('keeps the selection when the mousedown starts on a table', async () => {
    const { app, root } = await setup();
    const tableId = seedTable(app);
    await flush();

    const table = root.querySelector('.table[data-id]') as HTMLElement;
    dispatchMouse(table, 'mousedown', { clientX: 5, clientY: 5 });
    await flush();

    expect(app.store.state.editor.selectedMap[tableId]).toBe('table');
  });

  it('scrolls the canvas while dragging', async () => {
    const { app, root } = await setup();

    dispatchMouse(root, 'mousedown', { clientX: 100, clientY: 100 });
    const move = dispatchMouse(window, 'mousemove', {
      clientX: 60,
      clientY: 70,
    });
    await flush();

    expect(move.defaultPrevented).toBe(true);
    expect(app.store.state.settings.scrollLeft).toBe(-40);
    expect(app.store.state.settings.scrollTop).toBe(-30);

    dispatchMouse(window, 'mouseup');
  });

  it('ignores a drag move that did not move', async () => {
    const { app, root } = await setup();

    dispatchMouse(root, 'mousedown', { clientX: 100, clientY: 100 });
    dispatchMouse(window, 'mousemove', { clientX: 100, clientY: 100 });
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(0);
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
    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));
    await flush();

    dispatchMouse(root, 'mousedown', {
      clientX: 40,
      clientY: 60,
      ctrlKey: true,
      metaKey: true,
    });
    await flush();

    expect(root.querySelector(dragSelectSelector)).toBeNull();
  });
});

describe('Erd - color picker', () => {
  it('positions the color picker where the emitter asked for it', async () => {
    const { app, root } = await setup();

    app.emitter.emit(openColorPickerAction({ x: 40, y: 50, color: '#ff0000' }));
    await flush();

    const picker = root.querySelector('.color-picker') as HTMLElement;
    expect(picker.style.left).toBe('40px');
    expect(picker.style.top).toBe('50px');
    expect(colorPicker.create).toHaveBeenCalled();
  });

  it('applies the picked color to every selected table', async () => {
    const { app, root } = await setup();
    const tableId = seedTable(app);
    app.emitter.emit(openColorPickerAction({ x: 10, y: 10, color: '#ffffff' }));
    await flush();

    const instance = colorPicker.instances[colorPicker.instances.length - 1];
    instance.options.onChange('#123456');
    await flush();

    const table = app.store.state.collections.tableEntities[tableId];
    expect(table.ui.color).toBe('#123456');
    expect(root.querySelector('.color-picker')).toBeTruthy();
  });
});

describe('Erd - table properties', () => {
  const tabTitles = (root: HTMLElement) =>
    Array.from(
      root.querySelectorAll(`.${String(tablePropertiesStyles.tab)}`)
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

    const stop = findByText(toast.container, 'button', 'Stop')!;
    expect(stop).toBeTruthy();
    actions.length = 0;
    dispatchMouse(stop, 'click');
    await flush(6);

    expect(actions.map(action => action.type)).toContain(
      moveToTableAction.type
    );
    expect(app.store.state.editor.openMap[Open.automaticTablePlacement]).toBe(
      false
    );
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
