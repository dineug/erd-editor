// Map Columns on a real keyboard, over the editor parts that read one: the
// canvas shortcuts it holds off, the Find and Replace and palette chords that
// trade it for their panel, and native lists that open on their own keys.

import { query } from '@dineug/erd-editor-schema';
import { AnyAction, createRef, FC, ref, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import {
  MapSeedColumn,
  seedMapRelationship,
  seedMapTable,
} from '@/__test-utils__/mapColumnsSeed';
import { type AppContext, useAppContext } from '@/components/appContext';
import Erd from '@/components/erd/Erd';
import FindReplace from '@/components/find-replace/FindReplace';
import MapColumnsDialog from '@/components/map-columns/MapColumnsDialog';
import { openMapColumns } from '@/components/map-columns/openMapColumns';
import QuickSearch from '@/components/quick-search/QuickSearch';
import { themeContext } from '@/components/themeContext';
import ToastContainer from '@/components/toast-container/ToastContainer';
import { Open } from '@/constants/open';
import { RelationshipType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
  focusTableAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  changeRelationshipColumnsAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { removeTableAction } from '@/engine/modules/table/atom.actions';
import {
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { attachActionsTag, Tag } from '@/engine/tag';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { whenDrawn } from '@/konva/batchDraw';
import { hasAppleDevice } from '@/utils/device-detect';
import { openFindReplaceAction } from '@/utils/emitter';

/** The key $mod names in the browser the spec runs in, which is what the bindings read too. */
const MOD = hasAppleDevice() ? 'Meta' : 'Control';

/** The part of ErdEditor that reads the keyboard, around the scene, the panels and the dialog. */
const Editor: FC = (_, ctx) => {
  const app = useAppContext(ctx);
  const root = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, root);

  const handleKeydown = (event: KeyboardEvent) => {
    app.value.keydown$.next(event);
  };

  return () => (
    <div
      class="root"
      use:ref={ref(root)}
      tabindex="-1"
      style={{ width: '100%', height: '100%', position: 'relative' }}
      on:keydown={handleKeydown}
    >
      <Erd isDarkMode={false} mouseTracking={false} readonly={false} />
      <MapColumnsDialog readonly={false} isDarkMode={false} />
      <FindReplace readonly={false} />
      <QuickSearch />
      <ToastContainer />
    </div>
  );
};

const USERS: MapSeedColumn[] = [
  { id: 'u_id', name: 'id', dataType: 'int', primaryKey: true },
  { id: 'u_email', name: 'email', dataType: 'varchar', unique: true },
  { id: 'u_name', name: 'name', dataType: 'varchar' },
];

const ORDERS: MapSeedColumn[] = [
  { id: 'o_id', name: 'id', dataType: 'int', primaryKey: true },
  { id: 'o_user', name: 'users_id', dataType: 'bigint' },
  { id: 'o_mail', name: 'email', dataType: 'varchar' },
  { id: 'o_extra', name: 'extra', dataType: 'int' },
];

type Fixture = {
  app: AppContext;
  mounted: Mounted;
  root: HTMLDivElement;
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

async function setup({
  width = 900,
  users = USERS,
  orders = ORDERS,
}: {
  width?: number;
  users?: MapSeedColumn[];
  orders?: MapSeedColumn[];
} = {}): Promise<Fixture> {
  const app = createTestAppContext();
  const mounted = mount(<Editor />, app);
  mounted.container.setAttribute(
    'style',
    `width: ${width}px; height: 640px; position: relative;`
  );

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  app.store.dispatchSync(changeViewportAction({ width, height: 640 }));
  seedMapTable(app.store, 'u', 'users', users);
  seedMapTable(app.store, 'o', 'orders', orders);
  await flush();
  await whenDrawn();

  const root = mounted.container.querySelector('.root') as HTMLDivElement;
  root.focus();

  teardowns.push(() => {
    mounted.unmount();
    themeProvider.destroy();
  });

  return { app, mounted, root };
}

async function openCreate({ app }: Fixture) {
  openMapColumns(app, {
    mode: 'create',
    startTableId: 'u',
    endTableId: 'o',
    relationshipType: RelationshipType.OneN,
  });
  await flush();
}

async function openEdit({ app }: Fixture, relationshipId: string) {
  openMapColumns(app, { mode: 'edit', relationshipId });
  await flush();
}

const press = async (keys: string) => {
  await userEvent.keyboard(keys);
  await flush();
};

const box = ({ mounted }: Fixture) =>
  mounted.container.querySelector<HTMLElement>('[role="dialog"]');
const isOpen = ({ app }: Fixture) =>
  Boolean(app.store.state.editor.openMap[Open.mapColumns]);
const rowSelects = ({ mounted }: Fixture) =>
  Array.from(
    mounted.container.querySelectorAll<HTMLSelectElement>(
      'select[aria-label="Foreign key column"]'
    )
  );
const references = ({ mounted }: Fixture) =>
  mounted.container.querySelector<HTMLSelectElement>(
    '.map-columns-references select'
  );
const confirmOf = ({ mounted }: Fixture) =>
  mounted.container.querySelector<HTMLButtonElement>('.map-columns-confirm')!;
const messageOf = ({ mounted }: Fixture) =>
  mounted.container.querySelector('.map-columns-message')?.textContent ?? '';
const changedOf = ({ mounted }: Fixture) =>
  mounted.container.querySelector('.map-columns-changed')?.textContent ?? '';
const toastsOf = ({ mounted }: Fixture) =>
  Array.from(mounted.container.querySelectorAll('.toast-container')).map(
    toast => toast.textContent?.trim()
  );
const values = (fixture: Fixture) =>
  rowSelects(fixture).map(select => select.value);
const relationshipsOf = ({ app }: Fixture) =>
  query(app.store.state.collections)
    .collection('relationshipEntities')
    .selectByIds(app.store.state.doc.relationshipIds);
const columnOf = ({ app }: Fixture, id: string) =>
  query(app.store.state.collections)
    .collection('tableColumnEntities')
    .selectById(id);

async function choose(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
}

async function shared({ app }: Fixture, ...actions: AnyAction[]) {
  app.store.dispatchSync(attachActionsTag(Tag.shared, actions));
  await flush();
}

describe('Map Columns on a real keyboard', () => {
  it('closes on Escape, writing nothing', async () => {
    const fixture = await setup();
    await openCreate(fixture);
    expect(document.activeElement).toBe(confirmOf(fixture));

    await press('{Escape}');

    expect(isOpen(fixture)).toBe(false);
    expect(box(fixture)).toBeNull();
    expect(relationshipsOf(fixture)).toEqual([]);
  });

  it('closes on the stop key pressed while the focus is elsewhere in the editor', async () => {
    const fixture = await setup();
    await openCreate(fixture);
    fixture.root.focus();

    await press('{Escape}');

    expect(isOpen(fixture)).toBe(false);
  });

  it('keeps Space and Enter on a list from the hand tool and the cell editor', async () => {
    const fixture = await setup();
    const { store } = fixture.app;
    store.dispatchSync(focusTableAction({ tableId: 'o' }));
    await openCreate(fixture);
    const [select] = rowSelects(fixture);
    select.focus();

    await press(' ');
    expect(store.state.editor.handTool).toBe(false);

    select.focus();
    await press('{Enter}');
    expect(store.state.editor.focusTable?.edit).toBe(false);
    expect(isOpen(fixture)).toBe(true);
  });

  it('keeps Delete from removing the selected table under it', async () => {
    const fixture = await setup();
    const { store } = fixture.app;
    store.dispatchSync(
      selectAction({ o: SelectType.table }),
      focusTableAction({ tableId: 'o' })
    );
    await openCreate(fixture);
    rowSelects(fixture)[0].focus();

    await press('{Delete}');
    await press('{Backspace}');

    expect(store.state.doc.tableIds).toContain('o');
    expect(isOpen(fixture)).toBe(true);
  });

  it('keeps undo from changing the document the dialog shows', async () => {
    const fixture = await setup();
    const { store } = fixture.app;
    const columnIds = [...store.state.collections.tableEntities.o.columnIds];
    await openCreate(fixture);
    rowSelects(fixture)[0].focus();

    await press(`{${MOD}>}z{/${MOD}}`);

    expect(store.state.collections.tableEntities.o.columnIds).toEqual(
      columnIds
    );
    expect(isOpen(fixture)).toBe(true);
  });

  it('turns Tab round inside the box', async () => {
    const fixture = await setup();
    await openCreate(fixture);
    const controls = Array.from(
      box(fixture)!.querySelectorAll<HTMLElement>('select, button')
    );
    expect(controls).toHaveLength(4);
    controls[0].focus();

    for (const control of [...controls.slice(1), controls[0]]) {
      await press('{Tab}');
      expect(document.activeElement).toBe(control);
    }

    await press('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(controls[controls.length - 1]);
  });

  it('gives way to Find and Replace on its chord pressed inside, dropping what was picked', async () => {
    const fixture = await setup();
    await openCreate(fixture);
    const [select] = rowSelects(fixture);
    await choose(select, 'column:o_mail');
    select.focus();

    await press(`{${MOD}>}f{/${MOD}}`);

    const { openMap } = fixture.app.store.state.editor;
    expect(openMap[Open.findReplace]).toBe(true);
    expect(isOpen(fixture)).toBe(false);
    expect(
      fixture.mounted.container.querySelector('.find-replace')
    ).not.toBeNull();

    // An opening with no session closes at once, which shows none was kept.
    fixture.app.store.dispatchSync(
      changeOpenMapAction({ [Open.mapColumns]: true })
    );
    await flush();
    expect(isOpen(fixture)).toBe(false);
    expect(box(fixture)).toBeNull();
  });

  it('gives way to the palette on its chord pressed inside', async () => {
    const fixture = await setup();
    await openCreate(fixture);
    rowSelects(fixture)[0].focus();

    await press(`{${MOD}>}k{/${MOD}}`);

    expect(fixture.app.store.state.editor.openMap[Open.search]).toBe(true);
    expect(isOpen(fixture)).toBe(false);
    expect(box(fixture)).toBeNull();
  });

  it('opens fresh after Find and Replace closed it, keeping neither the mode nor the rows touched', async () => {
    const fixture = await setup();
    seedMapRelationship(
      fixture.app.store,
      'r1',
      ['u', ['u_id']],
      ['o', ['o_extra']]
    );
    await openEdit(fixture, 'r1');
    await choose(rowSelects(fixture)[0], 'column:o_mail');

    fixture.app.emitter.emit(openFindReplaceAction());
    await flush();
    expect(isOpen(fixture)).toBe(false);

    await openCreate(fixture);

    expect(confirmOf(fixture).textContent?.trim()).toBe('Map');
    expect(values(fixture)).toEqual(['column:o_user']);
  });
});

describe('Map Columns writing', () => {
  it('maps in one dispatch, one undo taking back the relationship and its aligned type alone', async () => {
    const fixture = await setup();
    const batches: AnyAction[][] = [];
    fixture.app.store.subscribe(actions => {
      actions.some(({ type }) => type.startsWith('relationship.')) &&
        batches.push(actions);
    });
    await openCreate(fixture);

    confirmOf(fixture).click();
    await flush();

    expect(batches).toHaveLength(1);
    expect(relationshipsOf(fixture)).toHaveLength(1);
    expect(columnOf(fixture, 'o_user')?.dataType).toBe('int');

    fixture.app.store.undo();
    await flush();

    expect(relationshipsOf(fixture)).toEqual([]);
    expect(columnOf(fixture, 'o_user')?.dataType).toBe('bigint');
    expect(fixture.app.store.state.doc.tableIds).toEqual(['u', 'o']);
    expect(
      fixture.app.store.state.collections.tableEntities.o.columnIds
    ).toEqual(['o_id', 'o_user', 'o_mail', 'o_extra']);
  });

  it('closes with a toast when a peer removes a table or the relationship it maps', async () => {
    const fixture = await setup();
    seedMapRelationship(
      fixture.app.store,
      'r1',
      ['u', ['u_id']],
      ['o', ['o_user']]
    );

    await openEdit(fixture, 'r1');
    await shared(fixture, removeRelationshipAction({ id: 'r1' }));
    expect(isOpen(fixture)).toBe(false);

    await openCreate(fixture);
    await shared(fixture, removeTableAction({ id: 'u' }));
    expect(isOpen(fixture)).toBe(false);

    expect(toastsOf(fixture)).toEqual([
      'Map Columns closed: the relationship was removed',
      'Map Columns closed: users was removed',
    ]);
  });
});

describe('Map Columns References', () => {
  it('shows only while the parent has two keys to choose between', async () => {
    const both = await setup();
    await openCreate(both);
    expect(references(both)?.value).toBe('primaryKey:u');
    teardowns.splice(0).forEach(teardown => teardown());

    const primaryOnly = await setup({
      users: [{ id: 'u_id', name: 'id', dataType: 'int', primaryKey: true }],
    });
    await openCreate(primaryOnly);
    expect(references(primaryOnly)).toBeNull();
    teardowns.splice(0).forEach(teardown => teardown());

    const primaryAlsoUnique = await setup({
      users: [
        {
          id: 'u_id',
          name: 'id',
          dataType: 'int',
          primaryKey: true,
          unique: true,
        },
      ],
    });
    await openCreate(primaryAlsoUnique);
    expect(references(primaryAlsoUnique)).toBeNull();
    teardowns.splice(0).forEach(teardown => teardown());

    const uniqueOnly = await setup({
      users: [
        { id: 'u_email', name: 'email', dataType: 'varchar', unique: true },
      ],
    });
    await openCreate(uniqueOnly);
    expect(references(uniqueOnly)).toBeNull();
    expect(values(uniqueOnly)).toEqual(['column:o_mail']);
  });
});

describe('Map Columns editing a stored mapping', () => {
  it('blocks Save on rows its lists cannot pair or whose child is gone', async () => {
    const fixture = await setup();
    seedMapRelationship(
      fixture.app.store,
      'r1',
      ['u', ['u_id', 'u_id']],
      ['o', ['o_user', 'o_mail']]
    );
    await openEdit(fixture, 'r1');

    expect(box(fixture)?.textContent).toContain('(invalid)');
    expect(confirmOf(fixture).disabled).toBe(true);
    expect(messageOf(fixture)).toBe(
      'Pick a key in References to fix this mapping'
    );

    await press('{Escape}');
    seedMapRelationship(
      fixture.app.store,
      'r2',
      ['u', ['u_id']],
      ['o', ['o_extra']]
    );
    fixture.app.store.dispatchSync(
      removeColumnAction({ id: 'o_extra', tableId: 'o' })
    );
    await openEdit(fixture, 'r2');

    const [select] = rowSelects(fixture);
    expect(select.selectedOptions[0]?.textContent).toBe('(removed)');
    expect(confirmOf(fixture).disabled).toBe(true);
    await choose(select, 'column:o_mail');
    expect(confirmOf(fixture).disabled).toBe(false);
  });

  it('keeps the stored rows of a parent with no key and lets a child be mended', async () => {
    const fixture = await setup({
      users: [{ id: 'u_name', name: 'name', dataType: 'varchar' }],
    });
    seedMapRelationship(
      fixture.app.store,
      'r1',
      ['u', ['u_name']],
      ['o', ['o_mail']]
    );
    await openEdit(fixture, 'r1');

    expect(references(fixture)).toBeNull();
    expect(values(fixture)).toEqual(['column:o_mail']);
    expect(messageOf(fixture)).toBe('users has no key to reference');

    await choose(rowSelects(fixture)[0], 'column:o_extra');
    confirmOf(fixture).click();
    await flush();

    expect(relationshipsOf(fixture)[0].end.columnIds).toEqual(['o_extra']);
  });

  it('stacks a row under 640 px of editor width, its headings gone', async () => {
    const fixture = await setup({ width: 600 });
    await openCreate(fixture);

    const rows = fixture.mounted.container.querySelector('.map-columns-rows')!;
    expect(rows.classList.contains('stacked')).toBe(true);
    expect(rows.textContent).not.toContain('Referenced column');
    const [parent, select] = Array.from(rows.children) as HTMLElement[];
    expect(select.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      parent.getBoundingClientRect().bottom
    );
  });
});

describe('Map Columns while a peer edits the diagram', () => {
  it('creating: empties a row whose child goes, rebuilds rows on a new key and refuses a duplicate', async () => {
    const fixture = await setup();
    await openCreate(fixture);
    expect(values(fixture)).toEqual(['column:o_user']);

    await shared(fixture, removeColumnAction({ id: 'o_user', tableId: 'o' }));
    expect(values(fixture)).toEqual(['']);
    expect(confirmOf(fixture).disabled).toBe(true);

    await choose(rowSelects(fixture)[0], 'column:o_mail');
    await shared(
      fixture,
      changeColumnPrimaryKeyAction({ id: 'u_name', tableId: 'u', value: true })
    );
    expect(values(fixture)).toEqual(['column:o_mail', '']);
    expect(confirmOf(fixture).disabled).toBe(true);

    await choose(rowSelects(fixture)[1], 'column:o_extra');
    expect(confirmOf(fixture).disabled).toBe(false);
    seedMapRelationship(
      fixture.app.store,
      'peer',
      ['u', ['u_id', 'u_name']],
      ['o', ['o_extra', 'o_mail']]
    );
    await flush();

    expect(messageOf(fixture)).toBe(
      'These columns are already linked by another relationship'
    );
    expect(confirmOf(fixture).disabled).toBe(true);
  });

  it('editing: follows the peer while untouched, keeps the rows it touched, and says it changed', async () => {
    const fixture = await setup({
      users: [
        { id: 'p_a', name: 'a', dataType: 'int', primaryKey: true },
        { id: 'p_b', name: 'b', dataType: 'int', primaryKey: true },
        { id: 'p_c', name: 'c', dataType: 'int' },
      ],
      orders: [
        { id: 'c_a', name: 'ca', dataType: 'int' },
        { id: 'c_b', name: 'cb', dataType: 'int' },
        { id: 'c_x', name: 'cx', dataType: 'int' },
      ],
    });
    seedMapRelationship(
      fixture.app.store,
      'r1',
      ['u', ['p_a', 'p_b']],
      ['o', ['c_a', 'c_b']]
    );
    await openEdit(fixture, 'r1');
    expect(values(fixture)).toEqual(['column:c_a', 'column:c_b']);

    await shared(
      fixture,
      changeRelationshipColumnsAction({
        id: 'r1',
        start: { tableId: 'u', columnIds: ['p_a', 'p_b'] },
        end: { tableId: 'o', columnIds: ['c_b', 'c_a'] },
      })
    );
    expect(values(fixture)).toEqual(['column:c_b', 'column:c_a']);
    expect(changedOf(fixture)).toBe(
      'This relationship changed while the dialog was open'
    );

    await choose(rowSelects(fixture)[0], 'column:c_x');
    await shared(
      fixture,
      changeRelationshipColumnsAction({
        id: 'r1',
        start: { tableId: 'u', columnIds: ['p_a'] },
        end: { tableId: 'o', columnIds: ['c_a'] },
      })
    );
    expect(values(fixture)).toEqual(['column:c_x', '']);
    expect(confirmOf(fixture).disabled).toBe(true);

    await choose(rowSelects(fixture)[1], 'column:c_b');
    expect(confirmOf(fixture).disabled).toBe(false);
    await shared(fixture, removeColumnAction({ id: 'c_x', tableId: 'o' }));
    expect(rowSelects(fixture)[0].selectedOptions[0]?.textContent).toBe(
      '(removed)'
    );
    expect(confirmOf(fixture).disabled).toBe(true);
  });

  it('editing: a peer changing the parent key reopens an untouched dialog on the stored columns', async () => {
    const fixture = await setup();
    seedMapRelationship(
      fixture.app.store,
      'r1',
      ['u', ['u_id']],
      ['o', ['o_user']]
    );
    await openEdit(fixture, 'r1');
    expect(references(fixture)?.value).toBe('primaryKey:u');

    await shared(
      fixture,
      changeColumnPrimaryKeyAction({ id: 'u_name', tableId: 'u', value: true })
    );

    expect(references(fixture)?.value).toBe('current');
    expect(messageOf(fixture)).toBe(
      'The referenced columns are not a key of users'
    );
    expect(changedOf(fixture)).toBe(
      'This relationship changed while the dialog was open'
    );
  });
});
