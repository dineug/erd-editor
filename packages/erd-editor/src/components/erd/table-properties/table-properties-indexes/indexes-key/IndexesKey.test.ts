import { html } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import IndexesKey from '@/components/erd/table-properties/table-properties-indexes/indexes-key/IndexesKey';
import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-key/IndexesKey.styles';
import type { ColumnKey } from '@/utils/tableKeys';

const PRIMARY_KEY: ColumnKey = {
  id: 'primaryKey:t1',
  kind: 'primaryKey',
  name: 'PK_users',
  columnIds: ['c1', 'c2'],
};

const UNIQUE: ColumnKey = {
  id: 'unique:c3',
  kind: 'unique',
  name: 'UQ_users_email',
  columnIds: ['c3'],
};

const template = (
  columnKey: ColumnKey,
  selected = false,
  onSelect = vi.fn()
) => html`
  <${IndexesKey}
    columnKey=${columnKey}
    selected=${selected}
    .onSelect=${onSelect}
  />
`;

const rowOf = (mounted: Mounted) =>
  mounted.container.querySelector(`.${String(styles.row)}`) as HTMLElement;

let app: AppContext;
let mounted: Mounted | null = null;

beforeEach(() => {
  app = createTestAppContext();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('IndexesKey', () => {
  it('shows a primary key as a filled PK tag and its name, read only', async () => {
    mounted = await mountAndFlush(template(PRIMARY_KEY), app);
    const row = rowOf(mounted);
    const [tagCell, nameCell] = Array.from(row.children) as HTMLElement[];
    const tag = tagCell.firstElementChild as HTMLElement;

    expect(row.getAttribute('title')).toBe('Primary Key');
    expect(tagCell.classList.contains('column-col')).toBe(true);
    expect(tag.tagName).toBe('SPAN');
    expect(tag.classList.contains(String(styles.tag))).toBe(true);
    expect(tag.textContent?.trim()).toBe('PK');
    expect(tag.getAttribute('title')).toBe('Primary Key');
    expect(row.querySelector('.checked')).toBeNull();
    expect(nameCell.textContent).toBe('PK_users');
    expect(nameCell.classList.contains(String(styles.name))).toBe(true);
    expect(row.querySelector('input')).toBeNull();
  });

  it('keeps its lock a direct child of the row, the one element titled Read Only', async () => {
    mounted = await mountAndFlush(template(PRIMARY_KEY), app);
    const row = rowOf(mounted);
    const locks = Array.from(
      mounted.container.querySelectorAll('[title="Read Only"]')
    );

    expect(locks).toHaveLength(1);
    expect(locks[0].parentElement).toBe(row);
    expect(locks[0].classList.contains('icon')).toBe(true);
    expect(locks[0].classList.contains(String(styles.lock))).toBe(true);
    expect(row.lastElementChild).toBe(locks[0]);
  });

  it('shows a unique column as a filled UQ tag', async () => {
    mounted = await mountAndFlush(template(UNIQUE), app);
    const row = rowOf(mounted);
    const tag = row.querySelector(`.${String(styles.tag)}`) as HTMLElement;

    expect(row.getAttribute('title')).toBe('Unique Column');
    expect(tag.textContent?.trim()).toBe('UQ');
    expect(tag.getAttribute('title')).toBe('Unique Column');
    expect(row.textContent).toContain('UQ_users_email');
  });

  it('titles nothing Unique, which the UQ toggle of an index row answers to', async () => {
    mounted = await mountAndFlush(template(UNIQUE), app);

    expect(mounted.container.querySelector('[title="Unique"]')).toBeNull();
  });

  it('takes the selected class from its prop', async () => {
    mounted = await mountAndFlush(template(UNIQUE, true), app);

    expect(rowOf(mounted).classList.contains('selected')).toBe(true);
  });

  it('reports its key through onSelect and changes nothing', async () => {
    const onSelect = vi.fn();
    mounted = await mountAndFlush(template(UNIQUE, false, onSelect), app);
    const history = app.store.history.size;
    const collections = JSON.stringify(app.store.state.collections);

    rowOf(mounted).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(UNIQUE);
    expect(app.store.history.size).toBe(history);
    expect(JSON.stringify(app.store.state.collections)).toBe(collections);
  });
});
