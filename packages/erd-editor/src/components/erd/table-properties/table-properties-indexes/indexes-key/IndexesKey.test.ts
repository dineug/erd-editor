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
import { COLUMN_UNIQUE_WIDTH } from '@/constants/layout';
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
  it('shows a primary key as a checked PK chip and its name, read only', async () => {
    mounted = await mountAndFlush(template(PRIMARY_KEY), app);
    const row = rowOf(mounted);
    const [chipCell, nameCell] = Array.from(row.children) as HTMLElement[];
    const chip = chipCell.firstElementChild as HTMLElement;

    expect(row.getAttribute('title')).toBe('Primary Key');
    expect(chip.textContent?.trim()).toBe('PK');
    expect(chip.classList.contains('checked')).toBe(true);
    expect(chip.style.width).toBe(`${COLUMN_UNIQUE_WIDTH}px`);
    expect(nameCell.textContent).toBe('PK_users');
    expect(nameCell.classList.contains(String(styles.name))).toBe(true);
    expect(row.querySelector('input')).toBeNull();
    expect(
      Array.from(row.querySelectorAll('.icon')).map(icon =>
        icon.getAttribute('title')
      )
    ).toEqual(['Read Only']);
    expect(
      row.querySelector('.icon')?.classList.contains(String(styles.lock))
    ).toBe(true);
  });

  it('shows a unique column as a checked UQ chip', async () => {
    mounted = await mountAndFlush(template(UNIQUE), app);
    const row = rowOf(mounted);

    expect(row.getAttribute('title')).toBe('Unique Column');
    expect(row.textContent).toContain('UQ');
    expect(row.textContent).toContain('UQ_users_email');
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
