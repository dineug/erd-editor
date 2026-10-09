import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  TABLE_GROUP_PADDING,
  TABLE_GROUP_TITLE_HEIGHT,
} from '@/constants/layout';
import { Clock } from '@/engine/clock';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  addTableAction,
  changeTableGroupAction,
} from '@/engine/modules/table/atom.actions';
import { ActionType } from '@/engine/modules/table-group/actions';
import {
  addTableGroupAction,
  removeTableGroupAction,
} from '@/engine/modules/table-group/atom.actions';
import {
  actions$,
  addTableGroupAction$,
  addTableGroupFromTablesAction$,
  moveTableGroupAction$,
  removeTableGroupAction$,
  selectTableGroupAction$,
  setTableGroupAction$,
  toMoveTableGroupActions,
} from '@/engine/modules/table-group/generator.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import { createStore, Store } from '@/engine/store';
import { Tag } from '@/engine/tag';
import { getTableRect } from '@/konva/scene/metrics';

const P = TABLE_GROUP_PADDING;
const T = TABLE_GROUP_TITLE_HEIGHT;
const UI = { x: 0, y: 0, width: 600, height: 400, zIndex: 1 };
const toWidth = (text: string) => text.length * 10;

function createTestStore(): Store {
  return createStore({ toWidth, clock: new Clock() });
}

function flatten(store: Store, action: any): AnyAction[] {
  return compositionActionsFlat(store.state, store.context, [action]);
}

function typesOf(store: Store, action: any): string[] {
  return flatten(store, action).map(({ type }) => type);
}

const groupIdOf = (store: Store | RxStore, tableId: string) =>
  store.state.collections.tableEntities[tableId].groupId;

let store: Store;

beforeEach(() => {
  store = createTestStore();
});

describe('actions$', () => {
  it('exports every generator action', () => {
    expect(Object.keys(actions$).sort()).toEqual([
      'addTableGroupAction$',
      'addTableGroupFromTablesAction$',
      'moveTableGroupAction$',
      'removeTableGroupAction$',
      'selectTableGroupAction$',
      'setTableGroupAction$',
    ]);
  });
});

describe('addTableGroupAction$', () => {
  it('adds the group at the rect, alone selected, over every group there', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g0', ui: { ...UI, zIndex: 4 } }),
      selectAction({ g0: SelectType.tableGroup })
    );

    store.dispatchSync(
      addTableGroupAction$({ x: 10, y: 20, width: 300, height: 200 })
    );

    const id = store.state.doc.tableGroupIds[1];
    expect(store.state.collections.tableGroupEntities[id].ui).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200,
      zIndex: 5,
    });
    expect(store.state.editor.selectedMap).toEqual({
      [id]: SelectType.tableGroup,
    });
  });

  it('takes in the tables in no group whose centre lies in the rect, and only those', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'other', ui: { ...UI, x: 5000 } }),
      addTableAction({ id: 'inside', ui: { x: 100, y: 100, zIndex: 2 } }),
      addTableAction({ id: 'outside', ui: { x: 2000, y: 100, zIndex: 2 } }),
      addTableAction({ id: 'grouped', ui: { x: 100, y: 200, zIndex: 2 } }),
      addTableAction({ id: 'stale', ui: { x: 100, y: 300, zIndex: 2 } }),
      changeTableGroupAction({ id: 'grouped', value: 'other' }),
      changeTableGroupAction({ id: 'stale', value: 'ghost' })
    );

    store.dispatchSync(addTableGroupAction$(UI));

    const id = store.state.doc.tableGroupIds[1];
    expect(groupIdOf(store, 'inside')).toBe(id);
    expect(groupIdOf(store, 'stale')).toBe(id);
    expect(groupIdOf(store, 'outside')).toBe('');
    expect(groupIdOf(store, 'grouped')).toBe('other');
  });

  it('emits the selection, the add and the memberships in one batch', () => {
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 2 } })
    );

    expect(typesOf(store, addTableGroupAction$(UI))).toEqual([
      'editor.unselectAll',
      'editor.focusTableEnd',
      'editor.select',
      ActionType.addTableGroup,
      'table.changeGroup',
    ]);
  });
});

describe('addTableGroupFromTablesAction$', () => {
  it('wraps the selected tables in their bounds and the padding, each joining it', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'old', ui: UI }),
      addTableAction({ id: 'a', ui: { x: 100, y: 100, zIndex: 2 } }),
      addTableAction({ id: 'b', ui: { x: 500, y: 300, zIndex: 2 } }),
      addTableAction({ id: 'c', ui: { x: 900, y: 900, zIndex: 2 } }),
      changeTableGroupAction({ id: 'b', value: 'old' }),
      selectAction({ a: SelectType.table, b: SelectType.table })
    );
    const a = getTableRect(
      store.state,
      store.state.collections.tableEntities.a
    );
    const b = getTableRect(
      store.state,
      store.state.collections.tableEntities.b
    );

    store.dispatchSync(addTableGroupFromTablesAction$());

    const id = store.state.doc.tableGroupIds[1];
    expect(store.state.collections.tableGroupEntities[id].ui).toEqual({
      x: a.x - P,
      y: a.y - P - T,
      width: b.x + b.width - a.x + P * 2,
      height: b.y + b.height - a.y + P * 2 + T,
      zIndex: 2,
    });
    expect(groupIdOf(store, 'a')).toBe(id);
    expect(groupIdOf(store, 'b')).toBe(id);
    expect(groupIdOf(store, 'c')).toBe('');
    expect(store.state.editor.selectedMap).toEqual({
      [id]: SelectType.tableGroup,
    });
  });

  it('takes the tables named over the selection, each once', () => {
    store.dispatchSync(
      addTableAction({ id: 'a', ui: { x: 100, y: 100, zIndex: 2 } }),
      addTableAction({ id: 'b', ui: { x: 500, y: 100, zIndex: 2 } }),
      selectAction({ a: SelectType.table })
    );

    expect(
      typesOf(store, addTableGroupFromTablesAction$(['b', 'b', 'ghost']))
    ).toEqual([
      'editor.unselectAll',
      'editor.focusTableEnd',
      'editor.select',
      ActionType.addTableGroup,
      'table.changeGroup',
    ]);
  });

  it('adds nothing without a table the document lists', () => {
    store.dispatchSync(
      addTableAction({ id: 'gone', ui: { x: 0, y: 0, zIndex: 2 } }),
      selectAction({ gone: SelectType.table })
    );
    store.state.doc.tableIds = [];

    expect(typesOf(store, addTableGroupFromTablesAction$())).toEqual([]);
  });
});

describe('removeTableGroupAction$', () => {
  beforeEach(() => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addTableGroupAction({ id: 'g2', ui: UI }),
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } }),
      addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 2 } }),
      addTableAction({ id: 't3', ui: { x: 0, y: 0, zIndex: 2 } }),
      changeTableGroupAction({ id: 't1', value: 'g1' }),
      changeTableGroupAction({ id: 't2', value: 'g1' }),
      changeTableGroupAction({ id: 't3', value: 'g2' })
    );
  });

  it('clears every member of the group named, then removes it', () => {
    expect(flatten(store, removeTableGroupAction$('g1'))).toEqual([
      changeTableGroupAction({ id: 't1', value: '' }),
      changeTableGroupAction({ id: 't2', value: '' }),
      removeTableGroupAction({ id: 'g1' }),
    ]);

    store.dispatchSync(removeTableGroupAction$('g1'));

    expect(store.state.doc.tableGroupIds).toEqual(['g2']);
    expect(['t1', 't2', 't3'].map(id => groupIdOf(store, id))).toEqual([
      '',
      '',
      'g2',
    ]);
  });

  it('removes the selected groups the document lists, nothing else', () => {
    store.dispatchSync(
      selectAction({
        g2: SelectType.tableGroup,
        gone: SelectType.tableGroup,
        t1: SelectType.table,
      })
    );

    store.dispatchSync(removeTableGroupAction$());

    expect(store.state.doc.tableGroupIds).toEqual(['g1']);
    expect(store.state.doc.tableIds).toEqual(['t1', 't2', 't3']);
    expect(groupIdOf(store, 't3')).toBe('');
    expect(typesOf(store, removeTableGroupAction$())).toEqual([]);
  });
});

describe('toMoveTableGroupActions', () => {
  beforeEach(() => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addTableAction({ id: 'member', ui: { x: 0, y: 0, zIndex: 2 } }),
      addTableAction({ id: 'loose', ui: { x: 0, y: 0, zIndex: 2 } }),
      changeTableGroupAction({ id: 'member', value: 'g1' })
    );
  });

  it('moves the groups and their members with the tables given, each once, as drags', () => {
    const actions = toMoveTableGroupActions(
      store.state,
      ['g1'],
      ['member', 'loose'],
      5,
      -5
    );

    expect(actions.map(({ type, payload }) => [type, payload])).toEqual([
      [ActionType.moveTableGroup, { ids: ['g1'], movementX: 5, movementY: -5 }],
      ['table.move', { ids: ['member', 'loose'], movementX: 5, movementY: -5 }],
    ]);
    for (const action of actions) {
      expect(action.tags).toBe(Tag.drag);
    }
  });

  it('sends no group move without a group, and nothing for nothing', () => {
    expect(
      toMoveTableGroupActions(store.state, [], ['loose'], 1, 1).map(
        ({ type }) => type
      )
    ).toEqual(['table.move']);
    expect(toMoveTableGroupActions(store.state, [], [], 1, 1)).toEqual([]);
  });
});

describe('moveTableGroupAction$', () => {
  it('moves the group and its members by the step', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addTableAction({ id: 'member', ui: { x: 100, y: 100, zIndex: 2 } }),
      addTableAction({ id: 'loose', ui: { x: 100, y: 100, zIndex: 2 } }),
      changeTableGroupAction({ id: 'member', value: 'g1' })
    );

    store.dispatchSync(moveTableGroupAction$(['g1'], 40, 10));

    const { tableEntities, tableGroupEntities } = store.state.collections;
    expect(tableGroupEntities.g1.ui).toMatchObject({ x: 40, y: 10 });
    expect(tableEntities.member.ui).toMatchObject({ x: 140, y: 110 });
    expect(tableEntities.loose.ui).toMatchObject({ x: 100, y: 100 });
  });
});

describe('setTableGroupAction$', () => {
  beforeEach(() => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } }),
      addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 2 } }),
      changeTableGroupAction({ id: 't2', value: 'g1' })
    );
  });

  it('sends a change for each table not already in the group', () => {
    expect(
      flatten(store, setTableGroupAction$(['t1', 't2', 't1', 'ghost'], 'g1'))
    ).toEqual([changeTableGroupAction({ id: 't1', value: 'g1' })]);
  });

  it('takes tables out with an empty id', () => {
    store.dispatchSync(setTableGroupAction$(['t1', 't2'], ''));

    expect(groupIdOf(store, 't2')).toBe('');
    expect(flatten(store, setTableGroupAction$(['t1', 't2'], ''))).toEqual([]);
  });

  it('sends nothing for a group the document does not list', () => {
    store.dispatchSync(removeTableGroupAction({ id: 'g1' }));

    expect(flatten(store, setTableGroupAction$(['t1'], 'g1'))).toEqual([]);
    expect(flatten(store, setTableGroupAction$(['t1'], 'ghost'))).toEqual([]);
  });
});

describe('selectTableGroupAction$', () => {
  beforeEach(() => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: { ...UI, zIndex: 3 } }),
      addTableGroupAction({ id: 'g2', ui: { ...UI, zIndex: 1 } }),
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 40 } }),
      selectAction({ t1: SelectType.table })
    );
  });

  it('selects the group alone and draws it over every group, tables aside', () => {
    store.dispatchSync(selectTableGroupAction$('g2', false));

    expect(store.state.editor.selectedMap).toEqual({
      g2: SelectType.tableGroup,
    });
    expect(store.state.collections.tableGroupEntities.g2.ui.zIndex).toBe(4);
  });

  it('adds the group to the selection under $mod', () => {
    store.dispatchSync(selectTableGroupAction$('g2', true));

    expect(store.state.editor.selectedMap).toEqual({
      t1: SelectType.table,
      g2: SelectType.tableGroup,
    });
  });
});

describe('table group generators on the history', () => {
  let rxStore: RxStore;

  afterEach(() => {
    vi.useRealTimers();
    rxStore.destroy();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    rxStore = createRxStore({ toWidth, clock: new Clock() });
    rxStore.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 2 } }),
      addTableAction({ id: 't2', ui: { x: 300, y: 100, zIndex: 2 } })
    );
    vi.advanceTimersByTime(300);
  });

  it('takes back a drawn group and the memberships it set in one undo', () => {
    const size = rxStore.history.size;

    rxStore.dispatchSync(addTableGroupAction$(UI));
    vi.advanceTimersByTime(300);

    expect(rxStore.history.size).toBe(size + 1);
    const [id] = rxStore.state.doc.tableGroupIds;
    expect(groupIdOf(rxStore, 't1')).toBe(id);

    rxStore.undo();

    expect(rxStore.state.doc.tableGroupIds).toEqual([]);
    expect(groupIdOf(rxStore, 't1')).toBe('');
    expect(groupIdOf(rxStore, 't2')).toBe('');
  });

  it('brings back a removed group with its members in one undo', () => {
    rxStore.dispatchSync(addTableGroupAction$(UI));
    vi.advanceTimersByTime(300);
    const [id] = rxStore.state.doc.tableGroupIds;
    const size = rxStore.history.size;

    rxStore.dispatchSync(removeTableGroupAction$(id));
    vi.advanceTimersByTime(300);

    expect(rxStore.history.size).toBe(size + 1);
    expect(groupIdOf(rxStore, 't1')).toBe('');

    rxStore.undo();

    expect(rxStore.state.doc.tableGroupIds).toEqual([id]);
    expect(groupIdOf(rxStore, 't1')).toBe(id);
    expect(groupIdOf(rxStore, 't2')).toBe(id);
  });

  it('takes back a group drag, members and all, in one undo', () => {
    rxStore.dispatchSync(addTableGroupAction$(UI));
    vi.advanceTimersByTime(300);
    const [id] = rxStore.state.doc.tableGroupIds;
    const size = rxStore.history.size;

    rxStore.dispatchSync(moveTableGroupAction$([id], 30, 0));
    rxStore.dispatchSync(moveTableGroupAction$([id], 30, 0));
    vi.advanceTimersByTime(300);

    expect(rxStore.history.size).toBe(size + 1);
    expect(rxStore.state.collections.tableEntities.t1.ui.x).toBe(160);

    rxStore.undo();

    expect(rxStore.state.collections.tableGroupEntities[id].ui.x).toBe(0);
    expect(rxStore.state.collections.tableEntities.t1.ui.x).toBe(100);
    expect(rxStore.state.collections.tableEntities.t2.ui.x).toBe(300);
  });
});
