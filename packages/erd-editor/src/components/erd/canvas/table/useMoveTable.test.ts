import { FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { useMoveTable } from '@/components/erd/canvas/table/useMoveTable';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { Table } from '@/internal-types';

type MoveStart = (event: MouseEvent | TouchEvent) => void;

type HostProps = {
  table: Table;
  capture: (onMoveStart: MoveStart) => void;
};

const Host: FC<HostProps> = (props, ctx) => {
  const { onMoveStart } = useMoveTable(ctx, props);
  props.capture(onMoveStart);

  return () => html`
    <div class="host" @mousedown=${onMoveStart} @touchstart=${onMoveStart}>
      <div class="table-header-color"></div>
      <div class="icon"></div>
      <div class="input-padding"><span class="deep-input">x</span></div>
      <div class="column-row"></div>
      <div class="plain"></div>
    </div>
  `;
};

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
  query: <T extends HTMLElement>(selector: string) => T;
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

  const container = mounted.container;

  return {
    app,
    table,
    otherTable,
    onMoveStart,
    query: <T extends HTMLElement>(selector: string) =>
      container.querySelector<T>(selector)!,
  };
}

const mousedownOn = (el: HTMLElement, clientX = 0, clientY = 0) =>
  el.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, clientX, clientY })
  );

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
    const { app, table, otherTable, query } = await setup();

    const otherZIndex = otherTable.ui.zIndex;
    mousedownOn(query('.plain'));
    await flush();

    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
    expect(app.store.state.editor.focusTable?.tableId).toBe(table.id);
    expect(table.ui.zIndex).toBeGreaterThan(otherZIndex);
  });

  it('replaces the previous selection when the modifier key is not held', async () => {
    const { app, table, otherTable, query } = await setup();

    app.store.dispatchSync(selectAction({ [otherTable.id]: SelectType.table }));
    mousedownOn(query('.plain'));
    await flush();

    expect(app.store.state.editor.selectedMap[otherTable.id]).toBeUndefined();
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('appends to the selection when the modifier key is held', async () => {
    const { app, table, otherTable, query } = await setup();

    app.store.dispatchSync(selectAction({ [otherTable.id]: SelectType.table }));

    query('.plain').dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, ctrlKey: true })
    );
    await flush();

    expect(app.store.state.editor.selectedMap[otherTable.id]).toBe(
      SelectType.table
    );
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('moves every selected table while dragging from a plain area', async () => {
    const { app, table, query } = await setup();

    const startX = table.ui.x;
    const startY = table.ui.y;

    mousedownOn(query('.plain'), 100, 100);
    mousemove(130, 150);
    await flush();

    expect(table.ui.x).toBe(startX + 30);
    expect(table.ui.y).toBe(startY + 50);
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('prevents the default of the forwarded mousemove', async () => {
    const { query } = await setup();

    mousedownOn(query('.plain'), 0, 0);
    const event = mousemove(10, 10);
    await flush();

    expect(event.defaultPrevented).toBe(true);
  });

  it('scales the movement by the zoom level', async () => {
    const { app, table, query } = await setup();

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    const startX = table.ui.x;

    mousedownOn(query('.plain'), 0, 0);
    mousemove(50, 0);
    await flush();

    expect(table.ui.x).toBe(startX + 100);
  });

  it('moves on touchmove without preventing the default', async () => {
    const { table, query } = await setup();

    const startX = table.ui.x;
    const startY = table.ui.y;

    query('.plain').dispatchEvent(touchEvent('touchstart', 10, 10));
    const move = touchEvent('touchmove', 40, 30);
    window.dispatchEvent(move);
    await flush();

    expect(table.ui.x).toBe(startX + 30);
    expect(table.ui.y).toBe(startY + 20);
    expect(move.defaultPrevented).toBe(false);
  });

  it.each([
    ['.table-header-color'],
    ['.column-row'],
    ['.icon'],
    ['.input-padding'],
    ['.deep-input'],
  ])('never starts a drag from %s', async selector => {
    const { app, table, query } = await setup();

    const startX = table.ui.x;
    const startY = table.ui.y;

    mousedownOn(query(selector), 0, 0);
    mousemove(80, 90);
    await flush();

    expect(table.ui.x).toBe(startX);
    expect(table.ui.y).toBe(startY);
    // the selection still happens even though the drag does not
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('ignores a move start without an event target', async () => {
    const { app, table, onMoveStart } = await setup();

    const before = app.store.state.editor.selectedMap[table.id];
    onMoveStart({ target: null } as unknown as MouseEvent);
    await flush();

    expect(app.store.state.editor.selectedMap[table.id]).toBe(before);
  });

  it('stops moving once the pointer is released', async () => {
    const { table, query } = await setup();

    mousedownOn(query('.plain'), 0, 0);
    mousemove(10, 0);
    await flush();
    const afterFirstMove = table.ui.x;

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    mousemove(200, 0);
    await flush();

    expect(table.ui.x).toBe(afterFirstMove);
  });
});
