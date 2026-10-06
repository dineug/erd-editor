import { query } from '@dineug/erd-editor-schema';
import { AnyAction, FC, observable } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  flush,
  mount,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__';
import {
  MapSeedColumn,
  seedMapRelationship,
  seedMapTable,
} from '@/__test-utils__/mapColumnsSeed';
import type { AppContext } from '@/components/appContext';
import { toOptionValue, toPick } from '@/components/map-columns/MapColumnsBody';
import MapColumnsDialog from '@/components/map-columns/MapColumnsDialog';
import { nameOf } from '@/components/map-columns/nameOf';
import { openMapColumns } from '@/components/map-columns/openMapColumns';
import ToastContainer from '@/components/toast-container/ToastContainer';
import { Open } from '@/constants/open';
import { CanvasType, RelationshipType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
} from '@/engine/modules/editor/atom.actions';
import {
  changeRelationshipColumnsAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  changeCanvasTypeAction,
  changeRelationshipDataTypeSyncAction,
} from '@/engine/modules/settings/atom.actions';
import { removeTableAction } from '@/engine/modules/table/atom.actions';
import {
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { attachActionsTag, Tag } from '@/engine/tag';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const harness = observable({ readonly: false });

const Harness: FC = () => () => (
  <>
    <MapColumnsDialog readonly={harness.readonly} isDarkMode={false} />
    <ToastContainer />
  </>
);

let app: AppContext;
let mounted: Mounted | null = null;

beforeEach(() => {
  harness.readonly = false;
  app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 1200, height: 800 }));
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const USERS: MapSeedColumn[] = [
  { id: 'u_id', name: 'id', dataType: 'int', primaryKey: true },
  { id: 'u_email', name: 'email', dataType: 'varchar', unique: true },
  { id: 'u_name', name: 'name', dataType: 'varchar' },
];

const ORDERS: MapSeedColumn[] = [
  { id: 'o_id', name: 'id', dataType: 'int', primaryKey: true },
  { id: 'o_user', name: 'users_id', dataType: 'bigint' },
  { id: 'o_mail', name: 'email', dataType: 'varchar' },
];

function seed(users = USERS, orders = ORDERS) {
  seedMapTable(app.store, 'u', 'users', users);
  seedMapTable(app.store, 'o', 'orders', orders);
}

async function mountDialog() {
  mounted = mount(<Harness />, app);
  await flush();
}

async function openCreate(startTableId = 'u', endTableId = 'o') {
  openMapColumns(app, {
    mode: 'create',
    startTableId,
    endTableId,
    relationshipType: RelationshipType.OneN,
  });
  await flush();
}

async function openEdit(relationshipId: string) {
  openMapColumns(app, { mode: 'edit', relationshipId });
  await flush();
}

const root = () => mounted!.container;
const dialog = () => root().querySelector<HTMLElement>('.map-columns') ?? null;
const isOpen = () => Boolean(app.store.state.editor.openMap[Open.mapColumns]);
const rowSelects = () =>
  Array.from(
    root().querySelectorAll<HTMLSelectElement>('select[data-parent-column-id]')
  );

/** The name assistive tech reads for a list: the text of the nodes its aria-labelledby lists. */
const accessibleName = (element: Element) => {
  const ids = element.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
  const scope = element.getRootNode() as Document | ShadowRoot;
  return ids
    .map(id => scope.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ');
};
const referencesSelect = () =>
  root().querySelector<HTMLSelectElement>('.map-columns-references select');
const confirmButton = () =>
  root().querySelector<HTMLButtonElement>('.map-columns-confirm')!;
const cancelButton = () =>
  root().querySelector<HTMLButtonElement>('.map-columns-cancel')!;
const message = () => root().querySelector<HTMLElement>('.map-columns-message');
const notes = () =>
  Array.from(root().querySelectorAll('.map-columns-note')).map(
    note => note.textContent
  );
const optionTexts = (select: HTMLSelectElement) =>
  Array.from(select.options).map(option => option.textContent);
const parentCells = () =>
  Array.from(
    root().querySelectorAll<HTMLElement>('.map-columns-rows > div')
  ).map(cell => cell.textContent?.trim());
const toastText = () =>
  Array.from(root().querySelectorAll('.toast-container')).map(
    toast => toast.textContent?.trim() ?? ''
  );

async function choose(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
}

const relationships = () =>
  query(app.store.state.collections)
    .collection('relationshipEntities')
    .selectByIds(app.store.state.doc.relationshipIds);

const shared = (...actions: AnyAction[]) =>
  app.store.dispatchSync(attachActionsTag(Tag.shared, actions));

describe('the names the dialog writes', () => {
  it('keeps a name as written and calls a blank or missing one unnamed', () => {
    expect(nameOf({ name: ' users ' }, sourceI18n)).toBe(' users ');
    expect(nameOf({ name: '  ' }, sourceI18n)).toBe('unnamed');
    expect(nameOf(undefined, sourceI18n)).toBe('unnamed');
    expect(
      nameOf({ name: '' }, createI18n('ko-KR', pseudoMessages('ko')))
    ).toBe('ko:unnamed');
  });
});

describe('the option values of a row', () => {
  it('round trip a pick, never mistaking a column named new for a new column', () => {
    expect(toOptionValue(null)).toBe('');
    expect(toPick('')).toBeNull();
    expect(toPick(toOptionValue({ kind: 'new' }))).toEqual({ kind: 'new' });
    expect(
      toPick(toOptionValue({ kind: 'existing', columnId: 'new' }))
    ).toEqual({ kind: 'existing', columnId: 'new' });
    expect(toPick('stray')).toBeNull();
  });
});

describe('MapColumnsDialog opening and closing', () => {
  it('renders nothing until opened, then the mapping from the drawn parent to the child', async () => {
    seed();
    await mountDialog();
    expect(dialog()).toBeNull();

    await openCreate();

    expect(isOpen()).toBe(true);
    expect(dialog()?.querySelector('h2')?.textContent).toBe('Map Columns');
    expect(
      root().querySelector('[role="dialog"]')?.getAttribute('aria-label')
    ).toBe('Map Columns');
    expect(root().querySelector('.map-columns-subtitle')?.textContent).toBe(
      'users → orders · One N'
    );
    expect(rowSelects()).toHaveLength(1);
    expect(rowSelects()[0].value).toBe('column:o_user');
    expect(confirmButton().textContent?.trim()).toBe('Map');
    expect(confirmButton().disabled).toBe(false);
  });

  it('closes on Cancel, Escape and a press on the dim, writing nothing', async () => {
    seed();
    await mountDialog();

    await openCreate();
    cancelButton().click();
    await flush();
    expect(isOpen()).toBe(false);
    expect(dialog()).toBeNull();

    await openCreate();
    dialog()!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await flush();
    expect(isOpen()).toBe(false);

    await openCreate();
    const dim = root().querySelector('[role="dialog"]')!
      .parentElement as HTMLElement;
    dim.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dim.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(isOpen()).toBe(false);

    expect(app.store.state.doc.relationshipIds).toEqual([]);
  });

  it('closes on the stop key heard outside the box', async () => {
    seed();
    await mountDialog();
    await openCreate();

    app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    });
    await flush();

    expect(isOpen()).toBe(false);
    expect(dialog()).toBeNull();
  });

  it('drops its session whatever closes it, so a later opening inherits none of it', async () => {
    seed();
    await mountDialog();
    await openCreate();
    await choose(rowSelects()[0], 'column:o_mail');
    expect(rowSelects()[0].value).toBe('column:o_mail');

    // Find and Replace and the palette close it through the open map alone.
    app.store.dispatchSync(changeOpenMapAction({ [Open.mapColumns]: false }));
    await flush();
    app.store.dispatchSync(changeOpenMapAction({ [Open.mapColumns]: true }));
    await flush();

    expect(dialog()).toBeNull();
    expect(isOpen()).toBe(false);

    await openCreate();
    expect(rowSelects()[0].value).toBe('column:o_user');
  });

  it('closes with a toast once a peer removes a table it maps between', async () => {
    seed();
    await mountDialog();
    await openCreate();

    shared(removeTableAction({ id: 'o' }));
    await flush();

    expect(isOpen()).toBe(false);
    expect(dialog()).toBeNull();
    expect(toastText()).toEqual(['Map Columns closed: orders was removed']);
  });

  it('names a removed table without a name unnamed', async () => {
    seed();
    seedMapTable(app.store, 'x', '', [{ id: 'x_a', name: 'a' }]);
    await mountDialog();
    await openCreate('u', 'x');

    shared(removeTableAction({ id: 'x' }));
    await flush();

    expect(toastText()).toEqual(['Map Columns closed: unnamed was removed']);
  });

  it('closes with a toast once a peer removes the relationship it edits', async () => {
    seed();
    seedMapRelationship(app.store, 'r1', ['u', ['u_id']], ['o', ['o_user']]);
    await mountDialog();
    await openEdit('r1');
    expect(dialog()).not.toBeNull();

    shared(removeRelationshipAction({ id: 'r1' }));
    await flush();

    expect(isOpen()).toBe(false);
    expect(toastText()).toEqual([
      'Map Columns closed: the relationship was removed',
    ]);
  });

  it('closes once the editor turns readonly, and opens nothing in a readonly one', async () => {
    seed();
    await mountDialog();
    await openCreate();

    harness.readonly = true;
    await flush();
    expect(isOpen()).toBe(false);
    expect(dialog()).toBeNull();

    await openCreate();
    expect(isOpen()).toBe(false);
    expect(dialog()).toBeNull();
  });

  it('closes once the ERD tab gives way to another', async () => {
    seed();
    await mountDialog();
    await openCreate();

    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    await flush();

    expect(isOpen()).toBe(false);
  });

  it('lets its session go when it unmounts', async () => {
    seed();
    await mountDialog();
    await openCreate();

    mounted!.unmount();
    mounted = null;
    await flush();

    expect(isOpen()).toBe(true);
  });
});

describe('MapColumnsDialog creating a relationship', () => {
  it('maps in one batch, one undo taking back the relationship and the type it aligned', async () => {
    seed();
    await mountDialog();
    const batches: AnyAction[][] = [];
    app.store.subscribe(actions => {
      actions.some(({ type }) => type === 'relationship.add') &&
        batches.push(actions);
    });
    await openCreate();
    expect(notes()).toEqual(['users_id becomes int']);

    confirmButton().click();
    await flush();

    expect(isOpen()).toBe(false);
    expect(batches).toHaveLength(1);
    expect(batches[0].map(({ type }) => type)).toEqual([
      'column.changeDataType',
      'relationship.add',
    ]);
    const [relationship] = relationships();
    expect(relationship.start).toMatchObject({
      tableId: 'u',
      columnIds: ['u_id'],
    });
    expect(relationship.end).toMatchObject({
      tableId: 'o',
      columnIds: ['o_user'],
    });
    expect(relationship.relationshipType).toBe(RelationshipType.OneN);

    app.store.undo();
    await flush();

    expect(relationships()).toEqual([]);
    expect(
      query(app.store.state.collections)
        .collection('tableColumnEntities')
        .selectById('o_user')?.dataType
    ).toBe('bigint');
  });

  it('says only that types differ while the data type sync is off', async () => {
    seed();
    app.store.dispatchSync(
      changeRelationshipDataTypeSyncAction({ value: false })
    );
    await mountDialog();
    await openCreate();

    expect(notes()).toEqual(['Types differ: int and bigint']);
  });

  it('refuses with a toast when the diagram changed before the mapping landed', async () => {
    seed();
    await mountDialog();
    await openCreate();

    confirmButton().click();
    app.store.dispatchSync(removeColumnAction({ id: 'o_user', tableId: 'o' }));
    await flush();

    expect(relationships()).toEqual([]);
    expect(toastText()).toEqual(["Couldn't map columns: the diagram changed"]);
  });

  it('offers a new column under the name it would take, and writes it with the relationship', async () => {
    seed();
    await mountDialog();
    await openCreate();

    expect(optionTexts(rowSelects()[0])).toEqual([
      'Pick a column',
      'New column: users_id_2',
      'id (int)',
      'users_id (bigint)',
      'email (varchar)',
    ]);
    await choose(rowSelects()[0], 'new');
    expect(notes()).toEqual([]);

    confirmButton().click();
    await flush();

    const [relationship] = relationships();
    const [newColumnId] = relationship.end.columnIds;
    expect(
      query(app.store.state.collections)
        .collection('tableColumnEntities')
        .selectById(newColumnId)?.name
    ).toBe('users_id_2');
  });

  it('shows References while the parent has two keys, and rebuilds the rows for the one picked', async () => {
    seed();
    await mountDialog();
    await openCreate();

    const references = referencesSelect()!;
    expect(optionTexts(references)).toEqual(['Primary Key', 'Unique: email']);
    expect(references.value).toBe('primaryKey:u');

    await choose(references, 'unique:u_email');

    expect(referencesSelect()!.value).toBe('unique:u_email');
    expect(parentCells()).toContain('emailvarchar');
    expect(rowSelects()[0].value).toBe('column:o_mail');
  });

  it('hides References for a primary key also marked unique', async () => {
    seed(
      [
        {
          id: 'u_id',
          name: 'id',
          dataType: 'int',
          primaryKey: true,
          unique: true,
        },
      ],
      ORDERS
    );
    await mountDialog();
    await openCreate();

    expect(referencesSelect()).toBeNull();
    expect(rowSelects()).toHaveLength(1);
  });

  it('hides References for a parent whose one key is a unique column, and maps that column', async () => {
    seed(
      [{ id: 'u_email', name: 'email', dataType: 'varchar', unique: true }],
      ORDERS
    );
    await mountDialog();
    await openCreate();

    expect(referencesSelect()).toBeNull();
    expect(parentCells()[2]).toBe('emailvarchar');
    expect(rowSelects()[0].value).toBe('column:o_mail');
  });

  it('shows no row for a parent with no key, saying so, and keeps Map off', async () => {
    seed([{ id: 'u_name', name: 'name', dataType: 'varchar' }], ORDERS);
    await mountDialog();
    await openCreate();

    expect(rowSelects()).toHaveLength(0);
    expect(message()?.textContent).toBe('users has no key to reference');
    expect(message()?.classList.contains('error')).toBe(true);
    expect(confirmButton().disabled).toBe(true);
  });

  it('marks a child column another row holds in use and refuses it there', async () => {
    seed(
      [
        { id: 'p_a', name: 'a', dataType: 'int', primaryKey: true },
        { id: 'p_b', name: 'b', dataType: 'int', primaryKey: true },
      ],
      [
        { id: 'c_x', name: 'x', dataType: 'int' },
        { id: 'c_y', name: '', dataType: 'int' },
      ]
    );
    await mountDialog();
    await openCreate();
    expect(rowSelects().map(select => select.value)).toEqual(['', '']);
    expect(confirmButton().disabled).toBe(true);

    await choose(rowSelects()[0], 'column:c_x');

    const second = rowSelects()[1];
    expect(optionTexts(second)).toContain('x (int) · in use');
    expect(optionTexts(second)).toContain('unnamed (int)');
    expect(
      Array.from(second.options).find(({ value }) => value === 'column:c_x')
        ?.disabled
    ).toBe(true);
  });

  it('names each row’s list after the key column it maps, so the lists of a composite key differ', async () => {
    seed(
      [
        {
          id: 'p_tenant',
          name: 'tenant_id',
          dataType: 'int',
          primaryKey: true,
        },
        { id: 'p_id', name: 'id', dataType: 'int', primaryKey: true },
      ],
      [{ id: 'c_x', name: 'x', dataType: 'int' }]
    );
    await mountDialog();
    await openCreate();

    expect(rowSelects().map(accessibleName)).toEqual([
      'Foreign key column tenant_id',
      'Foreign key column id',
    ]);

    app.store.dispatchSync(changeViewportAction({ width: 600, height: 800 }));
    await flush();

    expect(rowSelects().map(accessibleName)).toEqual([
      'Foreign key column tenant_id',
      'Foreign key column id',
    ]);
  });

  it('refuses a mapping of every column onto itself', async () => {
    seed();
    await mountDialog();
    await openCreate('u', 'u');
    expect(rowSelects()[0].value).toBe('');

    await choose(rowSelects()[0], 'column:u_id');

    expect(message()?.textContent).toBe(
      'At least one column must reference a different column'
    );
    expect(confirmButton().disabled).toBe(true);
  });

  it('refuses the columns another relationship already links', async () => {
    seed();
    seedMapRelationship(app.store, 'r1', ['u', ['u_id']], ['o', ['o_user']]);
    await mountDialog();
    await openCreate();

    expect(message()?.textContent).toBe(
      'These columns are already linked by another relationship'
    );
    expect(confirmButton().disabled).toBe(true);
  });

  it('follows a peer adding a column to the parent key, the new row left to pick', async () => {
    seed();
    await mountDialog();
    await openCreate();

    shared(
      changeColumnPrimaryKeyAction({ id: 'u_name', tableId: 'u', value: true })
    );
    await flush();

    expect(rowSelects().map(select => select.value)).toEqual([
      'column:o_user',
      '',
    ]);
    expect(confirmButton().disabled).toBe(true);
  });

  it('stacks the two columns of a row on a narrow editor, without their headings', async () => {
    seed();
    await mountDialog();
    await openCreate();
    expect(
      root().querySelector('.map-columns-rows')?.classList.contains('stacked')
    ).toBe(false);
    expect(parentCells().slice(0, 2)).toEqual([
      'Referenced column',
      'Foreign key column',
    ]);

    app.store.dispatchSync(changeViewportAction({ width: 600, height: 800 }));
    await flush();

    expect(
      root().querySelector('.map-columns-rows')?.classList.contains('stacked')
    ).toBe(true);
    expect(parentCells()[0]).toBe('idint');
  });
});

describe('MapColumnsDialog editing a relationship', () => {
  it('opens on the stored mapping with Save off until it changes, then saves it in place', async () => {
    seed();
    seedMapRelationship(
      app.store,
      'r1',
      ['u', ['u_id']],
      ['o', ['o_user']],
      RelationshipType.ZeroN
    );
    await mountDialog();
    await openEdit('r1');

    expect(root().querySelector('.map-columns-subtitle')?.textContent).toBe(
      'users → orders · Zero N'
    );
    expect(rowSelects()[0].value).toBe('column:o_user');
    expect(confirmButton().textContent?.trim()).toBe('Save');
    expect(confirmButton().disabled).toBe(true);

    await choose(rowSelects()[0], 'column:o_mail');
    expect(confirmButton().disabled).toBe(false);
    confirmButton().click();
    await flush();

    expect(relationships().map(({ id }) => id)).toEqual(['r1']);
    expect(relationships()[0].end.columnIds).toEqual(['o_mail']);
    expect(relationships()[0].relationshipType).toBe(RelationshipType.ZeroN);
  });

  it('follows a peer remapping the relationship while untouched, saying it changed', async () => {
    seed();
    seedMapRelationship(app.store, 'r1', ['u', ['u_id']], ['o', ['o_user']]);
    await mountDialog();
    await openEdit('r1');
    expect(root().querySelector('.map-columns-changed')).toBeNull();

    shared(
      changeRelationshipColumnsAction({
        id: 'r1',
        start: { tableId: 'u', columnIds: ['u_id'] },
        end: { tableId: 'o', columnIds: ['o_mail'] },
      })
    );
    await flush();

    expect(rowSelects()[0].value).toBe('column:o_mail');
    expect(root().querySelector('.map-columns-changed')?.textContent).toBe(
      'This relationship changed while the dialog was open'
    );
  });

  it('shows a child column gone from its table as removed, Save off until another is picked', async () => {
    seed();
    seedMapRelationship(app.store, 'r1', ['u', ['u_id']], ['o', ['o_user']]);
    app.store.dispatchSync(removeColumnAction({ id: 'o_user', tableId: 'o' }));
    await mountDialog();
    await openEdit('r1');

    const [select] = rowSelects();
    expect(select.value).toBe('column:o_user');
    expect(select.selectedOptions[0]?.textContent).toBe('(removed)');
    expect(confirmButton().disabled).toBe(true);

    await choose(select, 'column:o_mail');

    expect(confirmButton().disabled).toBe(false);
  });

  it('shows a mapping its lists cannot pair as invalid, asking for a key', async () => {
    seed();
    seedMapRelationship(
      app.store,
      'r1',
      ['u', ['u_id', 'u_id']],
      ['o', ['o_user', 'o_mail']]
    );
    await mountDialog();
    await openEdit('r1');

    expect(referencesSelect()?.value).toBe('current');
    expect(optionTexts(referencesSelect()!)).toContain(
      'Current columns (not a key)'
    );
    expect(parentCells()).toContain('(invalid)');
    expect(rowSelects().every(select => select.disabled)).toBe(true);
    expect(message()?.textContent).toBe(
      'Pick a key in References to fix this mapping'
    );
    expect(message()?.classList.contains('error')).toBe(false);
    expect(confirmButton().disabled).toBe(true);
  });

  it('warns of stored columns that are not a key, and still saves', async () => {
    seed();
    seedMapRelationship(app.store, 'r1', ['u', ['u_name']], ['o', ['o_user']]);
    await mountDialog();
    await openEdit('r1');

    expect(message()?.textContent).toBe(
      'The referenced columns are not a key of users'
    );
    await choose(rowSelects()[0], 'column:o_mail');

    expect(confirmButton().disabled).toBe(false);
  });

  it('keeps the stored rows of a parent with no key, asking for one where a row needs it', async () => {
    seed([{ id: 'u_name', name: 'name', dataType: 'varchar' }], ORDERS);
    seedMapRelationship(app.store, 'r1', ['u', ['u_name']], ['o', ['o_mail']]);
    seedMapRelationship(
      app.store,
      'r2',
      ['u', ['u_name']],
      ['o', ['o_mail', 'o_user']]
    );
    await mountDialog();
    await openEdit('r1');

    expect(referencesSelect()).toBeNull();
    expect(message()?.textContent).toBe('users has no key to reference');
    expect(message()?.classList.contains('error')).toBe(false);

    cancelButton().click();
    await flush();
    await openEdit('r2');

    expect(message()?.textContent).toBe(
      'Add a primary key or unique column to users to fix this mapping'
    );
    expect(confirmButton().disabled).toBe(true);
  });

  it('shows a parent column gone from its table as removed', async () => {
    seed();
    seedMapRelationship(app.store, 'r1', ['u', ['u_name']], ['o', ['o_user']]);
    app.store.dispatchSync(removeColumnAction({ id: 'u_name', tableId: 'u' }));
    await mountDialog();
    await openEdit('r1');

    expect(parentCells()).toContain('(removed)');
    expect(confirmButton().disabled).toBe(true);
  });
});

describe('MapColumnsDialog / language', () => {
  let teardown: (() => void) | null = null;

  afterEach(() => {
    teardown?.();
    teardown = null;
  });

  /** The language the element would provide, English until a spec switches it. */
  function provideLanguage() {
    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);
    teardown = () => provider.destroy();

    return async () => {
      Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
      await flush();
    };
  }

  /** The row lists by place, since their name follows the language. */
  const rowLists = () =>
    Array.from(
      root().querySelectorAll<HTMLSelectElement>('.map-columns-rows select')
    );

  it('writes a new mapping in the language the element shows, following a switch', async () => {
    const switchLanguage = provideLanguage();
    seed();
    await mountDialog();
    await openCreate();
    expect(dialog()?.querySelector('h2')?.textContent).toBe('Map Columns');

    await switchLanguage();

    expect(dialog()?.querySelector('h2')?.textContent).toBe('ko:Map Columns');
    expect(
      root().querySelector('[role="dialog"]')?.getAttribute('aria-label')
    ).toBe('ko:Map Columns');
    expect(root().querySelector('.map-columns-subtitle')?.textContent).toBe(
      'ko:users → orders · ko:One N'
    );
    expect(
      root().querySelector('.map-columns-references span')?.textContent
    ).toBe('ko:References');
    expect(optionTexts(referencesSelect()!)).toEqual([
      'ko:Primary Key',
      'ko:Unique: email',
    ]);
    expect(parentCells().slice(0, 2)).toEqual([
      'ko:Referenced column',
      'ko:Foreign key column',
    ]);
    const [list] = rowLists();
    expect(accessibleName(list)).toBe('ko:Foreign key column id');
    expect(optionTexts(list)).toEqual([
      'ko:Pick a column',
      'ko:New column: users_id_2',
      'ko:id (int)',
      'ko:users_id (bigint)',
      'ko:email (varchar)',
    ]);
    expect(notes()).toEqual(['ko:users_id becomes int']);
    expect(cancelButton().textContent?.trim()).toBe('ko:Cancel');
    expect(confirmButton().textContent?.trim()).toBe('ko:Map');
  });

  it('says what stands in the way in that language', async () => {
    const switchLanguage = provideLanguage();
    seed(
      [
        { id: 'p_a', name: 'a', dataType: 'int', primaryKey: true },
        { id: 'p_b', name: 'b', dataType: 'int', primaryKey: true },
      ],
      [{ id: 'c_x', name: '', dataType: 'bigint' }]
    );
    app.store.dispatchSync(
      changeRelationshipDataTypeSyncAction({ value: false })
    );
    await mountDialog();
    await openCreate('u', 'o');
    await switchLanguage();

    await choose(rowLists()[0], 'column:c_x');

    expect(optionTexts(rowLists()[1])).toContain(
      'ko:ko:unnamed (bigint) · in use'
    );
    expect(notes()).toEqual(['ko:Types differ: int and bigint']);

    await openCreate('u', 'u');
    await choose(rowLists()[0], 'column:p_a');
    await choose(rowLists()[1], 'column:p_b');

    expect(message()?.textContent).toBe(
      'ko:At least one column must reference a different column'
    );
  });

  it('edits a stored mapping in that language', async () => {
    const switchLanguage = provideLanguage();
    seed();
    seedMapRelationship(app.store, 'r1', ['u', ['u_name']], ['o', ['o_user']]);
    seedMapRelationship(
      app.store,
      'r2',
      ['u', ['u_id', 'u_id']],
      ['o', ['o_user', 'o_mail']]
    );
    await mountDialog();
    await switchLanguage();
    await openEdit('r1');

    expect(confirmButton().textContent?.trim()).toBe('ko:Save');
    expect(message()?.textContent).toBe(
      'ko:The referenced columns are not a key of users'
    );

    shared(
      changeRelationshipColumnsAction({
        id: 'r1',
        start: { tableId: 'u', columnIds: ['u_id'] },
        end: { tableId: 'o', columnIds: ['o_mail'] },
      })
    );
    await flush();
    expect(root().querySelector('.map-columns-changed')?.textContent).toBe(
      'ko:This relationship changed while the dialog was open'
    );

    cancelButton().click();
    await flush();
    await openEdit('r2');

    expect(optionTexts(referencesSelect()!)).toContain(
      'ko:Current columns (not a key)'
    );
    expect(parentCells()).toContain('ko:(invalid)');
    expect(message()?.textContent).toBe(
      'ko:Pick a key in References to fix this mapping'
    );
  });

  it('closes with toasts that follow a switch after they show, a table with no name too', async () => {
    const switchLanguage = provideLanguage();
    seed();
    seedMapTable(app.store, 'x', '', [{ id: 'x_a', name: 'a' }]);
    seedMapRelationship(app.store, 'r1', ['u', ['u_id']], ['o', ['o_user']]);
    await mountDialog();

    await openEdit('r1');
    shared(removeRelationshipAction({ id: 'r1' }));
    await flush();
    await openCreate();
    confirmButton().click();
    app.store.dispatchSync(removeColumnAction({ id: 'o_user', tableId: 'o' }));
    await flush();
    await openCreate('u', 'x');
    shared(removeTableAction({ id: 'x' }));
    await flush();
    expect(toastText()).toEqual([
      'Map Columns closed: the relationship was removed',
      "Couldn't map columns: the diagram changed",
      'Map Columns closed: unnamed was removed',
    ]);

    await switchLanguage();

    expect(toastText()).toEqual([
      'ko:Map Columns closed: the relationship was removed',
      "ko:Couldn't map columns: the diagram changed",
      'ko:Map Columns closed: ko:unnamed was removed',
    ]);
  });
});
