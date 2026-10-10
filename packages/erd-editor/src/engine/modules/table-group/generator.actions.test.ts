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
import { Show } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { moveAllAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
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
  dropTablesIntoGroupsAction$,
  getCarriedTableIds,
  getTableGroupDrops,
  moveTableGroupAction$,
  removeTableGroupAction$,
  selectTableGroupAction$,
  selectTableGroupTablesAction$,
  setTableGroupAction$,
  toMoveTableGroupActions,
} from '@/engine/modules/table-group/generator.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import { createStore, Store } from '@/engine/store';
import { attachActionTag, Tag } from '@/engine/tag';
import { getTableRect } from '@/konva/scene/metrics';
import { bHas } from '@/utils/bit';

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
      'dropTablesIntoGroupsAction$',
      'moveTableGroupAction$',
      'removeTableGroupAction$',
      'selectTableGroupAction$',
      'selectTableGroupTablesAction$',
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

  it('names and colors the group in the batch that adds it, and leaves both unset when not given', () => {
    store.dispatchSync(
      addTableGroupAction$(UI, { name: 'billing', color: '#3b82f6' })
    );
    store.dispatchSync(addTableGroupAction$(UI, { name: '', color: '' }));

    const [named, plain] = store.state.doc.tableGroupIds.map(
      id => store.state.collections.tableGroupEntities[id]
    );
    expect(named).toMatchObject({ name: 'billing', color: '#3b82f6' });
    expect(plain).toMatchObject({ name: '', color: '' });
    expect(
      typesOf(store, addTableGroupAction$(UI, { name: 'billing' }))
    ).toEqual([
      'editor.unselectAll',
      'editor.focusTableEnd',
      'editor.select',
      ActionType.addTableGroup,
      ActionType.changeTableGroupName,
    ]);
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

  it('names and colors the group it wraps around the tables', () => {
    store.dispatchSync(
      addTableAction({ id: 'a', ui: { x: 100, y: 100, zIndex: 2 } })
    );

    store.dispatchSync(
      addTableGroupFromTablesAction$(['a'], { name: 'core', color: '#ff8800' })
    );

    const id = store.state.doc.tableGroupIds[0];
    expect(store.state.collections.tableGroupEntities[id]).toMatchObject({
      name: 'core',
      color: '#ff8800',
    });
    expect(groupIdOf(store, 'a')).toBe(id);
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

  it('carries the tables given and the members of the groups, each once', () => {
    expect(getCarriedTableIds(store.state, ['g1'], ['loose'])).toEqual([
      'loose',
      'member',
    ]);
    expect(getCarriedTableIds(store.state, ['g1'], ['member'])).toEqual([
      'member',
    ]);
    expect(getCarriedTableIds(store.state, [], [])).toEqual([]);
  });

  it('moves the groups and the tables they carry by the step, as drags', () => {
    const actions = toMoveTableGroupActions(['g1'], ['member', 'loose'], 5, -5);

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
      toMoveTableGroupActions([], ['loose'], 1, 1).map(({ type }) => type)
    ).toEqual(['table.move']);
    expect(toMoveTableGroupActions([], [], 1, 1)).toEqual([]);
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

describe('getTableGroupDrops', () => {
  const drops = () =>
    getTableGroupDrops(store.state).map(({ table, groupId }) => [
      table.id,
      groupId,
    ]);

  beforeEach(() => {
    store.dispatchSync(
      addTableGroupAction({ id: 'low', ui: { ...UI, zIndex: 1 } }),
      addTableGroupAction({ id: 'high', ui: { ...UI, width: 300, zIndex: 2 } }),
      addTableGroupAction({ id: 'far', ui: { ...UI, x: 2000, zIndex: 3 } }),
      addTableAction({ id: 'inHigh', ui: { x: 40, y: 80, zIndex: 9 } }),
      addTableAction({ id: 'inLow', ui: { x: 400, y: 80, zIndex: 9 } }),
      addTableAction({ id: 'out', ui: { x: 1200, y: 80, zIndex: 9 } }),
      addTableAction({ id: 'member', ui: { x: 2100, y: 80, zIndex: 9 } }),
      changeTableGroupAction({ id: 'out', value: 'low' }),
      changeTableGroupAction({ id: 'member', value: 'far' })
    );
  });

  it('puts each selected table in the topmost box holding its centre, or in none', () => {
    store.dispatchSync(
      selectAction({
        inHigh: SelectType.table,
        inLow: SelectType.table,
        out: SelectType.table,
      })
    );

    expect(drops()).toEqual([
      ['inHigh', 'high'],
      ['inLow', 'low'],
      ['out', ''],
    ]);
  });

  it('reads each box without the tables it judges, so a table leaving its group is not held by it', () => {
    store.dispatchSync(
      selectAction({ out: SelectType.table }),
      changeTableGroupAction({ id: 'inLow', value: 'low' }),
      changeTableGroupAction({ id: 'out', value: 'low' })
    );

    expect(drops()).toEqual([['out', '']]);
  });

  it('leaves out a member a selected group carries, and what the document does not list', () => {
    store.dispatchSync(
      selectAction({
        far: SelectType.tableGroup,
        member: SelectType.table,
        ghost: SelectType.table,
        inHigh: SelectType.table,
      })
    );

    expect(drops()).toEqual([['inHigh', 'high']]);
  });

  it('judges no table while groups are hidden', () => {
    store.dispatchSync(
      selectAction({ inHigh: SelectType.table }),
      changeShowAction({ show: Show.hideTableGroup, value: true })
    );

    expect(drops()).toEqual([]);
  });

  it('keeps a table in the box its group held as the drag began, which a group the drag moves reads none of', () => {
    // A member standing past its group's stored rect, as one that grew or a
    // peer moved, sits in the box its own padding drew as the drag began.
    const wide = { x: 0, y: 0, width: 1600, height: 400 };
    const judge = (held: Map<string, typeof wide>) =>
      getTableGroupDrops(store.state, held).map(({ table, groupId, box }) => [
        table.id,
        groupId,
        box,
      ]);
    store.dispatchSync(selectAction({ out: SelectType.table }));

    expect(judge(new Map([['low', wide]]))).toEqual([['out', 'low', wide]]);
    expect(drops()).toEqual([['out', '']]);

    expect(judge(new Map([['high', wide]]))).toEqual([['out', 'high', wide]]);
    store.dispatchSync(selectAction({ high: SelectType.tableGroup }));
    expect(judge(new Map([['high', wide]]))).toEqual([['out', '', null]]);
  });

  it('hands each drop the box of the group it lands in, and none for no group', () => {
    store.dispatchSync(
      selectAction({ inHigh: SelectType.table, out: SelectType.table })
    );

    expect(
      getTableGroupDrops(store.state).map(({ table, box }) => [table.id, box])
    ).toEqual([
      ['inHigh', { x: 0, y: 0, width: 300, height: 400 }],
      ['out', null],
    ]);
  });

  it('judges nothing for a drag of groups alone, or of members their groups carry', () => {
    store.dispatchSync(selectAction({ far: SelectType.tableGroup }));
    expect(drops()).toEqual([]);

    store.dispatchSync(selectAction({ member: SelectType.table }));
    expect(drops()).toEqual([]);
  });
});

describe('dropTablesIntoGroupsAction$', () => {
  beforeEach(() => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addTableAction({ id: 'joins', ui: { x: 40, y: 80, zIndex: 2 } }),
      addTableAction({ id: 'stays', ui: { x: 300, y: 80, zIndex: 2 } }),
      addTableAction({ id: 'leaves', ui: { x: 1200, y: 80, zIndex: 2 } }),
      changeTableGroupAction({ id: 'stays', value: 'g1' }),
      changeTableGroupAction({ id: 'leaves', value: 'g1' }),
      selectAction({
        joins: SelectType.table,
        stays: SelectType.table,
        leaves: SelectType.table,
      })
    );
  });

  it('moves only the tables whose group changes, each tagged as the drag with the group it held', () => {
    const actions = flatten(store, dropTablesIntoGroupsAction$());

    expect(actions).toEqual([
      attachActionTag(
        Tag.drag,
        changeTableGroupAction({ id: 'joins', value: 'g1', prevValue: '' })
      ),
      attachActionTag(
        Tag.drag,
        changeTableGroupAction({ id: 'leaves', value: '', prevValue: 'g1' })
      ),
    ]);
    expect(actions.every(({ tags }) => bHas(tags!, Tag.drag))).toBe(true);
  });

  it('reads a groupId naming no listed group as none, and sends nothing for it left out', () => {
    store.dispatchSync(
      changeTableGroupAction({ id: 'leaves', value: 'ghost' }),
      unselectAllAction(),
      selectAction({ leaves: SelectType.table })
    );

    expect(flatten(store, dropTablesIntoGroupsAction$())).toEqual([]);
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

describe('selectTableGroupTablesAction$', () => {
  beforeEach(() => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: { ...UI, zIndex: 1 } }),
      addTableGroupAction({ id: 'g2', ui: { ...UI, zIndex: 2 } }),
      addTableAction({ id: 'a', ui: { x: 0, y: 0, zIndex: 3 } }),
      addTableAction({ id: 'b', ui: { x: 0, y: 0, zIndex: 4 } }),
      addTableAction({ id: 'c', ui: { x: 0, y: 0, zIndex: 5 } }),
      changeTableGroupAction({ id: 'a', value: 'g1' }),
      changeTableGroupAction({ id: 'b', value: 'g1' }),
      changeTableGroupAction({ id: 'c', value: 'g2' }),
      selectAction({ g1: SelectType.tableGroup, c: SelectType.table })
    );
  });

  it("selects the group's tables alone, the group and the rest let go", () => {
    store.dispatchSync(selectTableGroupTablesAction$('g1'));

    expect(store.state.editor.selectedMap).toEqual({
      a: SelectType.table,
      b: SelectType.table,
    });
  });

  it('leaves nothing selected for a group without tables, or one the document does not list', () => {
    store.dispatchSync(changeTableGroupAction({ id: 'c', value: '' }));

    store.dispatchSync(selectTableGroupTablesAction$('g2'));
    expect(store.state.editor.selectedMap).toEqual({});

    store.dispatchSync(
      selectAction({ a: SelectType.table }),
      selectTableGroupTablesAction$('ghost')
    );
    expect(store.state.editor.selectedMap).toEqual({});
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

  it('takes back a table drag and the group its drop joined in one undo', () => {
    rxStore.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: { ...UI, x: 1000 } }),
      selectAction({ t1: SelectType.table })
    );
    vi.advanceTimersByTime(300);
    const size = rxStore.history.size;

    rxStore.dispatchSync(moveAllAction$(500, 0));
    rxStore.dispatchSync(moveAllAction$(500, 0));
    rxStore.dispatchSync(dropTablesIntoGroupsAction$());
    vi.advanceTimersByTime(300);

    expect(groupIdOf(rxStore, 't1')).toBe('g1');
    expect(rxStore.history.size).toBe(size + 1);

    rxStore.undo();

    expect(groupIdOf(rxStore, 't1')).toBe('');
    expect(rxStore.state.collections.tableEntities.t1.ui.x).toBe(100);

    rxStore.redo();

    expect(groupIdOf(rxStore, 't1')).toBe('g1');
    expect(rxStore.state.collections.tableEntities.t1.ui.x).toBe(1100);
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
