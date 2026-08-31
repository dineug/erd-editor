import { FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import type { ScenePointerEvent } from '@/components/erd/canvas/sceneTokens';
import { useMoveTable } from '@/components/erd/canvas/table/useMoveTable';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { Table } from '@/internal-types';

type MoveStart = (event: ScenePointerEvent) => void;

type HostProps = {
  table: Table;
  capture: (onMoveStart: MoveStart) => void;
};

const Host: FC<HostProps> = (props, ctx) => {
  const { onMoveStart } = useMoveTable(ctx, props);
  props.capture(onMoveStart);

  return () => html`<div class="host"></div>`;
};

/**
 * A scene node as the hook reads one: a kind and a parent. The gesture routing
 * walks konva parents rather than dom ancestors, so the fixture is a chain of
 * kinds and needs no stage behind it.
 */
type FakeNode = {
  getAttr(name: string): unknown;
  getParent(): FakeNode | null;
};

const node = (
  kind: string | null,
  parent: FakeNode | null = null
): FakeNode => ({
  getAttr: (name: string) => (name === 'kind' ? kind : undefined),
  getParent: () => parent,
});

/** The table group every fixture node hangs under, as konva nests them. */
const tableNode = () => node('table');

const inside = (kind: string | null) => node(kind, tableNode());

const sceneEvent = (target: FakeNode, evt: Event) =>
  ({
    target,
    evt,
    type: evt.type,
    currentTarget: target,
  }) as unknown as ScenePointerEvent;

let mounted: Mounted | null = null;

afterEach(() => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  mounted?.unmount();
  mounted = null;
});

type Fixture = {
  app: AppContext;
  table: Table;
  otherTable: Table;
  onMoveStart: MoveStart;
  /**
   * Delivers the native event the way konva does: the window stream that feeds
   * drag$ sees it first, and the handler runs while the dispatch is still live
   * so a preventDefault inside it still counts.
   */
  fire: (target: FakeNode, evt: Event) => Event;
};

async function setup(): Promise<Fixture> {
  const app = createTestAppContext();
  const { store } = app;

  store.dispatchSync(addTableAction$());
  store.dispatchSync(addTableAction$());
  const [tableId, otherTableId] = store.state.doc.tableIds;
  const table = store.state.collections.tableEntities[tableId];
  const otherTable = store.state.collections.tableEntities[otherTableId];

  let onMoveStart!: MoveStart;

  mounted = mount(
    html`<${Host}
      table=${table}
      .capture=${(value: MoveStart) => (onMoveStart = value)}
    />`,
    app
  );
  await flush();

  return {
    app,
    table,
    otherTable,
    onMoveStart,
    fire: (target: FakeNode, evt: Event) => {
      const listener = () => onMoveStart(sceneEvent(target, evt));
      window.addEventListener(evt.type, listener, { once: true });
      window.dispatchEvent(evt);
      window.removeEventListener(evt.type, listener);
      return evt;
    },
  };
}

const mousedown = (init: MouseEventInit = {}) =>
  new MouseEvent('mousedown', { bubbles: true, cancelable: true, ...init });

const mousemove = (clientX: number, clientY: number) => {
  const event = new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  window.dispatchEvent(event);
  return event;
};

function touchEvent(type: string, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: [{ clientX, clientY }],
  });
  return event;
}

describe('useMoveTable', () => {
  it('selects the table and brings it to the front on move start', async () => {
    const { app, table, otherTable, fire } = await setup();

    const otherZIndex = otherTable.ui.zIndex;
    fire(inside('table-body'), mousedown());
    await flush();

    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
    expect(app.store.state.editor.focusTable?.tableId).toBe(table.id);
    expect(table.ui.zIndex).toBeGreaterThan(otherZIndex);
  });

  it('replaces the previous selection when the modifier key is not held', async () => {
    const { app, table, otherTable, fire } = await setup();

    app.store.dispatchSync(selectAction({ [otherTable.id]: SelectType.table }));
    fire(inside('table-body'), mousedown());
    await flush();

    expect(app.store.state.editor.selectedMap[otherTable.id]).toBeUndefined();
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('appends to the selection when the modifier key is held', async () => {
    const { app, table, otherTable, fire } = await setup();

    app.store.dispatchSync(selectAction({ [otherTable.id]: SelectType.table }));
    fire(inside('table-body'), mousedown({ ctrlKey: true }));
    await flush();

    expect(app.store.state.editor.selectedMap[otherTable.id]).toBe(
      SelectType.table
    );
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('moves every selected table while dragging from a plain area', async () => {
    const { app, table, fire } = await setup();

    const startX = table.ui.x;
    const startY = table.ui.y;

    fire(inside('table-body'), mousedown({ clientX: 100, clientY: 100 }));
    mousemove(130, 150);
    await flush();

    expect(table.ui.x).toBe(startX + 30);
    expect(table.ui.y).toBe(startY + 50);
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('prevents the default of the forwarded mousemove', async () => {
    const { fire } = await setup();

    fire(inside('table-body'), mousedown({ clientX: 0, clientY: 0 }));
    const event = mousemove(10, 10);
    await flush();

    expect(event.defaultPrevented).toBe(true);
  });

  it('scales the movement by the zoom level', async () => {
    const { app, table, fire } = await setup();

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    const startX = table.ui.x;

    fire(inside('table-body'), mousedown({ clientX: 0, clientY: 0 }));
    mousemove(50, 0);
    await flush();

    expect(table.ui.x).toBe(startX + 100);
  });

  it('moves on touchmove without preventing the default', async () => {
    const { table, fire } = await setup();

    const startX = table.ui.x;
    const startY = table.ui.y;

    fire(inside('table-body'), touchEvent('touchstart', 10, 10));
    const move = touchEvent('touchmove', 40, 30);
    window.dispatchEvent(move);
    await flush();

    expect(table.ui.x).toBe(startX + 30);
    expect(table.ui.y).toBe(startY + 20);
    expect(move.defaultPrevented).toBe(false);
  });

  it.each([
    ['table-header-color'],
    ['column-row'],
    ['icon'],
    ['input-padding'],
  ])('never starts a drag from a %s node', async kind => {
    const { app, table, fire } = await setup();

    const startX = table.ui.x;
    const startY = table.ui.y;

    fire(inside(kind), mousedown({ clientX: 0, clientY: 0 }));
    mousemove(80, 90);
    await flush();

    expect(table.ui.x).toBe(startX);
    expect(table.ui.y).toBe(startY);
    // the selection still happens even though the drag does not
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('never starts a drag from a shape nested inside a blocked node', async () => {
    const { table, fire } = await setup();

    const startX = table.ui.x;
    const cell = node('cell-text', inside('input-padding'));

    fire(cell, mousedown({ clientX: 0, clientY: 0 }));
    mousemove(80, 0);
    await flush();

    expect(table.ui.x).toBe(startX);
  });

  it('ignores a move start without an event target', async () => {
    const { app, table, onMoveStart } = await setup();

    const before = app.store.state.editor.selectedMap[table.id];
    onMoveStart({ target: null } as unknown as ScenePointerEvent);
    await flush();

    expect(app.store.state.editor.selectedMap[table.id]).toBe(before);
  });

  it('hands an Alt+drag to the duplicate ghost instead of moving the table', async () => {
    const { app, table, fire } = await setup();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });

    const startX = table.ui.x;
    const startY = table.ui.y;

    const event = fire(inside('table-body'), mousedown({ altKey: true }));
    mousemove(130, 150);
    await flush();

    expect(duplicateDragStart).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    // no second drag$ subscription — the ghost owns the gesture from here
    expect(table.ui.x).toBe(startX);
    expect(table.ui.y).toBe(startY);
  });

  it('keeps a multi selection when the Alt+drag starts on a selected table', async () => {
    const { app, table, otherTable, fire } = await setup();
    const selected = {
      [table.id]: SelectType.table,
      [otherTable.id]: SelectType.table,
    };
    app.store.dispatchSync(selectAction(selected));

    fire(inside('table-body'), mousedown({ altKey: true }));
    await flush();

    expect({ ...app.store.state.editor.selectedMap }).toEqual(selected);
  });

  it('never starts a duplicate from an area the drag is blocked on', async () => {
    const { app, table, fire } = await setup();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });

    fire(inside('icon'), mousedown({ altKey: true }));
    await flush();

    expect(duplicateDragStart).not.toHaveBeenCalled();
    // the blocked area still selects, exactly as it does without Alt
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('never starts a duplicate from a non-primary button', async () => {
    const { app, table, fire } = await setup();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });

    const startX = table.ui.x;
    fire(inside('table-body'), mousedown({ altKey: true, button: 2 }));
    mousemove(30, 0);
    await flush();

    expect(duplicateDragStart).not.toHaveBeenCalled();
    expect(table.ui.x).toBe(startX + 30);
  });

  it('never starts a duplicate from a touch start', async () => {
    const { app, table, fire } = await setup();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });

    const startX = table.ui.x;
    fire(inside('table-body'), touchEvent('touchstart', 10, 10));
    window.dispatchEvent(touchEvent('touchmove', 40, 10));
    await flush();

    expect(duplicateDragStart).not.toHaveBeenCalled();
    expect(table.ui.x).toBe(startX + 30);
  });

  it('leaves the drag alone when Alt is not held', async () => {
    const { app, table, fire } = await setup();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });

    const startX = table.ui.x;
    fire(inside('table-body'), mousedown({ clientX: 0, clientY: 0 }));
    mousemove(40, 0);
    await flush();

    expect(duplicateDragStart).not.toHaveBeenCalled();
    expect(table.ui.x).toBe(startX + 40);
  });

  it('stops moving once the pointer is released', async () => {
    const { table, fire } = await setup();

    fire(inside('table-body'), mousedown({ clientX: 0, clientY: 0 }));
    mousemove(10, 0);
    await flush();
    const afterFirstMove = table.ui.x;

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    mousemove(200, 0);
    await flush();

    expect(table.ui.x).toBe(afterFirstMove);
  });
});
