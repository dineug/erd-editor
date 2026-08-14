import { query } from '@dineug/erd-editor-schema';
import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import HighLevelTable from '@/components/erd/canvas/high-level-table/HighLevelTable';
import * as highLevelTableStyles from '@/components/erd/canvas/high-level-table/HighLevelTable.styles';
import * as tableStyles from '@/components/erd/canvas/table/Table.styles';
import {
  TABLE_BORDER,
  TABLE_HEADER_HEIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import type { Table } from '@/internal-types';
import {
  fontSize5,
  fontSize6,
  fontSize7,
  fontSize8,
  fontSize9,
} from '@/styles/typography.styles';
import { calcTableWidths } from '@/utils/calcTable';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});

const TABLE_ID = 'table-1';

const seedTable = (
  app: AppContext,
  { name = 'users', color = '#00ff00' } = {}
): Table => {
  app.store.dispatchSync(
    addTableAction({ id: TABLE_ID, ui: { x: 30, y: 40, zIndex: 7 } })
  );
  app.store.dispatchSync(changeTableNameAction({ id: TABLE_ID, value: name }));
  app.store.dispatchSync(
    changeTableColorAction({ id: TABLE_ID, color, prevColor: '' })
  );
  return query(app.store.state.collections)
    .collection('tableEntities')
    .selectById(TABLE_ID)!;
};

const rootOf = () => mounted!.container.querySelector<HTMLElement>('.table')!;
const nameOf = () =>
  mounted!.container.querySelector<HTMLElement>(
    `.${String(highLevelTableStyles.name)}`
  )!;

const mousedown = (el: Element, clientX = 0, clientY = 0, init = {}) =>
  el.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      ...init,
    })
  );

const mousemove = (clientX: number, clientY: number) =>
  window.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    })
  );

const mountTable = async (app: AppContext, table: Table) => {
  mounted = await mountAndFlush(
    html`<${HighLevelTable} table=${table} />`,
    app
  );
  return mounted;
};

describe('HighLevelTable', () => {
  it('positions the table box and stamps its id on the root', async () => {
    const app = createTestAppContext();
    const table = seedTable(app);
    await mountTable(app, table);

    const el = rootOf();
    expect(el.classList.contains(String(tableStyles.root))).toBe(true);
    expect(el.style.top).toBe('40px');
    expect(el.style.left).toBe('30px');
    expect(el.style.zIndex).toBe('7');
    expect(el.dataset.id).toBe(TABLE_ID);
  });

  it('sizes the box from the calculated widths and the column-less header height', async () => {
    const app = createTestAppContext();
    const table = seedTable(app);
    await mountTable(app, table);

    const el = rootOf();
    expect(el.style.width).toBe(
      `${calcTableWidths(table, app.store.state).width}px`
    );
    expect(el.style.height).toBe(
      `${TABLE_BORDER * 2 + TABLE_PADDING * 2 + TABLE_HEADER_HEIGHT}px`
    );
  });

  it('marks the root as selected while the table is in the selection map', async () => {
    const app = createTestAppContext();
    const table = seedTable(app);
    await mountTable(app, table);

    expect(rootOf().hasAttribute('data-selected')).toBe(false);

    app.store.dispatchSync(selectAction({ [TABLE_ID]: SelectType.table }));
    await flush();

    expect(rootOf().hasAttribute('data-selected')).toBe(true);
  });

  it('paints the header color bar from the table color', async () => {
    const app = createTestAppContext();
    const table = seedTable(app, { color: '#00ff00' });
    await mountTable(app, table);

    const color = mounted!.container.querySelector<HTMLElement>(
      '.table-header-color'
    )!;
    expect(color.style.backgroundColor).toBe('#00ff00');
  });

  it('renders the table name without the empty modifier', async () => {
    const app = createTestAppContext();
    const table = seedTable(app, { name: 'users' });
    await mountTable(app, table);

    const el = nameOf();
    expect(el.textContent?.trim()).toBe('users');
    expect(el.classList.contains('isEmptyName')).toBe(false);
    expect(el.classList.contains('scrollbar')).toBe(true);
  });

  it('falls back to `unnamed` and the empty modifier for a blank name', async () => {
    const app = createTestAppContext();
    const table = seedTable(app, { name: '   ' });
    await mountTable(app, table);

    const el = nameOf();
    expect(el.textContent?.trim()).toBe('unnamed');
    expect(el.classList.contains('isEmptyName')).toBe(true);
  });

  it('scales the name typography down as the canvas zooms out', async () => {
    const app = createTestAppContext();
    const table = seedTable(app);
    await mountTable(app, table);

    expect(nameOf().classList.contains(String(fontSize5))).toBe(true);

    const zoomTo = async (value: number) => {
      app.store.dispatchSync(changeZoomLevelAction({ value }));
      await flush();
      return nameOf();
    };

    expect((await zoomTo(0.6)).classList.contains(String(fontSize6))).toBe(
      true
    );
    expect((await zoomTo(0.5)).classList.contains(String(fontSize7))).toBe(
      true
    );
    expect((await zoomTo(0.4)).classList.contains(String(fontSize8))).toBe(
      true
    );
    expect((await zoomTo(0.3)).classList.contains(String(fontSize9))).toBe(
      true
    );
    expect((await zoomTo(0.61)).classList.contains(String(fontSize5))).toBe(
      true
    );
  });

  it('emits an openColorPicker action with the pointer position and current color', async () => {
    const app = createTestAppContext();
    const openColorPicker = vi.fn();
    app.emitter.on({ openColorPicker });
    const table = seedTable(app, { color: '#123456' });
    await mountTable(app, table);

    mounted!.container
      .querySelector('.table-header-color')!
      .dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 9 })
      );

    expect(openColorPicker).toHaveBeenCalledTimes(1);
    expect(openColorPicker.mock.calls[0][0].payload).toEqual({
      x: 5,
      y: 9,
      color: '#123456',
    });
  });

  it('selects the table on mousedown and drags it with the pointer', async () => {
    const app = createTestAppContext();
    const table = seedTable(app);
    await mountTable(app, table);

    mousedown(rootOf(), 100, 100);
    await flush();

    expect(app.store.state.editor.selectedMap[TABLE_ID]).toBe(SelectType.table);

    mousemove(140, 160);
    await flush();

    expect(table.ui.x).toBe(70);
    expect(table.ui.y).toBe(100);
  });

  it('does not drag when the mousedown lands on the color bar', async () => {
    const app = createTestAppContext();
    const table = seedTable(app);
    await mountTable(app, table);

    mousedown(
      mounted!.container.querySelector('.table-header-color')!,
      100,
      100
    );
    await flush();

    expect(app.store.state.editor.selectedMap[TABLE_ID]).toBe(SelectType.table);

    mousemove(140, 160);
    await flush();

    expect(table.ui.x).toBe(30);
    expect(table.ui.y).toBe(40);
  });

  it('adds to the selection instead of replacing it when the mod key is held', async () => {
    const app = createTestAppContext();
    const table = seedTable(app);
    app.store.dispatchSync(selectAction({ other: SelectType.memo }));
    await mountTable(app, table);

    mousedown(rootOf(), 0, 0, { ctrlKey: true, metaKey: true });
    await flush();

    expect(app.store.state.editor.selectedMap).toEqual({
      other: SelectType.memo,
      [TABLE_ID]: SelectType.table,
    });
  });
});
