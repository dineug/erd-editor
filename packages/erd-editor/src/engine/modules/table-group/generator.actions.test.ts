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
import {
  addMemoAction,
  changeMemoGroupAction,
} from '@/engine/modules/memo/atom.actions';
import { removeMemoAction$ } from '@/engine/modules/memo/generator.actions';
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
  getCarriedMemoIds,
  getCarriedTableIds,
  getTableGroupDrops,
  moveTableGroupAction$,
  removeTableGroupAction$,
  selectTableGroupAction$,
  selectTableGroupTablesAction$,
  setMemoGroupAction$,
  setTableGroupAction$,
  toMoveTableGroupActions,
} from '@/engine/modules/table-group/generator.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import { createStore, Store } from '@/engine/store';
import { attachActionTag, Tag } from '@/engine/tag';
import { getMemoRect, getTableRect, unionRect } from '@/konva/scene/metrics';
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

const memoGroupIdOf = (store: Store | RxStore, memoId: string) =>
  store.state.collections.memoEntities[memoId].groupId;

const hideMemos = changeShowAction({ show: Show.hideMemo, value: true });

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
      'setMemoGroupAction$',
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

  it('takes in the shown memos in no group whose centre lies in the rect, and only those', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'other', ui: { ...UI, x: 5000 } }),
      addMemoAction({ id: 'inside', ui: { x: 100, y: 100, zIndex: 2 } }),
      addMemoAction({ id: 'outside', ui: { x: 2000, y: 100, zIndex: 2 } }),
      addMemoAction({ id: 'grouped', ui: { x: 100, y: 200, zIndex: 2 } }),
      addMemoAction({ id: 'stale', ui: { x: 100, y: 250, zIndex: 2 } }),
      // Its corner is inside, its centre is not.
      addMemoAction({ id: 'edge', ui: { x: 590, y: 300, zIndex: 2 } }),
      changeMemoGroupAction({ id: 'grouped', value: 'other' }),
      changeMemoGroupAction({ id: 'stale', value: 'ghost' })
    );

    store.dispatchSync(addTableGroupAction$(UI));

    const id = store.state.doc.tableGroupIds[1];
    expect(memoGroupIdOf(store, 'inside')).toBe(id);
    expect(memoGroupIdOf(store, 'stale')).toBe(id);
    expect(memoGroupIdOf(store, 'outside')).toBe('');
    expect(memoGroupIdOf(store, 'edge')).toBe('');
    expect(memoGroupIdOf(store, 'grouped')).toBe('other');
  });

  it('takes in no memo while memos are hidden', () => {
    store.dispatchSync(
      addMemoAction({ id: 'inside', ui: { x: 100, y: 100, zIndex: 2 } }),
      hideMemos
    );

    store.dispatchSync(addTableGroupAction$(UI));

    expect(memoGroupIdOf(store, 'inside')).toBe('');
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
      ActionType.addTableGroup,
      'editor.select',
      ActionType.changeTableGroupName,
    ]);
  });

  it('emits the add, the selection and the memberships in one batch', () => {
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 2 } }),
      addMemoAction({ id: 'm1', ui: { x: 300, y: 100, zIndex: 2 } })
    );

    expect(typesOf(store, addTableGroupAction$(UI))).toEqual([
      'editor.unselectAll',
      'editor.focusTableEnd',
      ActionType.addTableGroup,
      'editor.select',
      'table.changeGroup',
      'memo.changeGroup',
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
      ActionType.addTableGroup,
      'editor.select',
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

  it('puts the selected memos beside the selected tables in it, its rect holding them too', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'old', ui: UI }),
      addTableAction({ id: 'a', ui: { x: 100, y: 100, zIndex: 2 } }),
      addMemoAction({ id: 'm1', ui: { x: 900, y: 700, zIndex: 2 } }),
      addMemoAction({ id: 'm2', ui: { x: 0, y: 0, zIndex: 2 } }),
      changeMemoGroupAction({ id: 'm1', value: 'old' }),
      selectAction({ a: SelectType.table, m1: SelectType.memo })
    );
    const { tableEntities, memoEntities } = store.state.collections;
    const rect = unionRect(
      getTableRect(store.state, tableEntities.a),
      getMemoRect(memoEntities.m1)
    );

    store.dispatchSync(addTableGroupFromTablesAction$());

    const id = store.state.doc.tableGroupIds[1];
    expect(store.state.collections.tableGroupEntities[id].ui).toEqual({
      x: rect.x - P,
      y: rect.y - P - T,
      width: rect.width + P * 2,
      height: rect.height + P * 2 + T,
      zIndex: 2,
    });
    expect(groupIdOf(store, 'a')).toBe(id);
    expect(memoGroupIdOf(store, 'm1')).toBe(id);
    expect(memoGroupIdOf(store, 'm2')).toBe('');
  });

  it('adds nothing for selected memos alone', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }),
      selectAction({ m1: SelectType.memo })
    );

    expect(typesOf(store, addTableGroupFromTablesAction$())).toEqual([]);
  });

  it('takes the memos named, and beside tables named no selected memo', () => {
    store.dispatchSync(
      addTableAction({ id: 'a', ui: { x: 100, y: 100, zIndex: 2 } }),
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'm2', ui: { x: 0, y: 0, zIndex: 2 } }),
      selectAction({ m1: SelectType.memo })
    );

    expect(flatten(store, addTableGroupFromTablesAction$(['a']))).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'memo.changeGroup' }),
      ])
    );

    store.dispatchSync(
      addTableGroupFromTablesAction$(['a'], {}, ['m2', 'm2', 'ghost'])
    );

    const id = store.state.doc.tableGroupIds[0];
    expect(memoGroupIdOf(store, 'm1')).toBe('');
    expect(memoGroupIdOf(store, 'm2')).toBe(id);
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
      changeTableGroupAction({ id: 't3', value: 'g2' }),
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'm2', ui: { x: 0, y: 0, zIndex: 2 } }),
      changeMemoGroupAction({ id: 'm1', value: 'g1' }),
      changeMemoGroupAction({ id: 'm2', value: 'g2' })
    );
  });

  it('clears every member of the group named, tables and memos, then removes it', () => {
    expect(flatten(store, removeTableGroupAction$('g1'))).toEqual([
      changeTableGroupAction({ id: 't1', value: '' }),
      changeTableGroupAction({ id: 't2', value: '' }),
      changeMemoGroupAction({ id: 'm1', value: '' }),
      removeTableGroupAction({ id: 'g1' }),
    ]);

    store.dispatchSync(removeTableGroupAction$('g1'));

    expect(store.state.doc.tableGroupIds).toEqual(['g2']);
    expect(['t1', 't2', 't3'].map(id => groupIdOf(store, id))).toEqual([
      '',
      '',
      'g2',
    ]);
    expect(['m1', 'm2'].map(id => memoGroupIdOf(store, id))).toEqual([
      '',
      'g2',
    ]);
  });

  it('clears a hidden member memo too', () => {
    store.dispatchSync(hideMemos);

    expect(flatten(store, removeTableGroupAction$('g2'))).toContainEqual(
      changeMemoGroupAction({ id: 'm2', value: '' })
    );
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

  it('carries the memos given and the member memos of the groups, hidden ones too, each once', () => {
    store.dispatchSync(
      addMemoAction({ id: 'note', ui: { x: 0, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'free', ui: { x: 0, y: 0, zIndex: 2 } }),
      changeMemoGroupAction({ id: 'note', value: 'g1' }),
      hideMemos
    );

    expect(getCarriedMemoIds(store.state, ['g1'], ['free'])).toEqual([
      'free',
      'note',
    ]);
    expect(getCarriedMemoIds(store.state, ['g1'], ['note'])).toEqual(['note']);
    expect(getCarriedMemoIds(store.state, [], [])).toEqual([]);
  });

  it('moves the memos it carries by the same step, after the tables, as drags', () => {
    const actions = toMoveTableGroupActions(['g1'], ['member'], 5, -5, [
      'note',
    ]);

    expect(actions.map(({ type, payload }) => [type, payload])).toEqual([
      [ActionType.moveTableGroup, { ids: ['g1'], movementX: 5, movementY: -5 }],
      ['table.move', { ids: ['member'], movementX: 5, movementY: -5 }],
      ['memo.move', { ids: ['note'], movementX: 5, movementY: -5 }],
    ]);
    for (const action of actions) {
      expect(action.tags).toBe(Tag.drag);
    }
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

  it('moves its member memos, hidden ones too, and leaves the rest', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addMemoAction({ id: 'member', ui: { x: 100, y: 100, zIndex: 2 } }),
      addMemoAction({ id: 'loose', ui: { x: 100, y: 100, zIndex: 2 } }),
      changeMemoGroupAction({ id: 'member', value: 'g1' }),
      hideMemos
    );

    store.dispatchSync(moveTableGroupAction$(['g1'], 40, 10));

    const { memoEntities } = store.state.collections;
    expect(memoEntities.member.ui).toMatchObject({ x: 140, y: 110 });
    expect(memoEntities.loose.ui).toMatchObject({ x: 100, y: 100 });
  });
});

describe('setMemoGroupAction$', () => {
  beforeEach(() => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'm2', ui: { x: 0, y: 0, zIndex: 2 } }),
      changeMemoGroupAction({ id: 'm2', value: 'g1' })
    );
  });

  it('sends a change for each memo not already in the group', () => {
    expect(
      flatten(store, setMemoGroupAction$(['m1', 'm2', 'm1', 'ghost'], 'g1'))
    ).toEqual([changeMemoGroupAction({ id: 'm1', value: 'g1' })]);
  });

  it('takes memos out with an empty id', () => {
    store.dispatchSync(setMemoGroupAction$(['m1', 'm2'], ''));

    expect(memoGroupIdOf(store, 'm2')).toBe('');
    expect(flatten(store, setMemoGroupAction$(['m1', 'm2'], ''))).toEqual([]);
  });

  it('sends nothing for a group the document does not list', () => {
    store.dispatchSync(removeTableGroupAction({ id: 'g1' }));

    expect(flatten(store, setMemoGroupAction$(['m1'], 'g1'))).toEqual([]);
    expect(flatten(store, setMemoGroupAction$(['m1'], 'ghost'))).toEqual([]);
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
    getTableGroupDrops(store.state).map(({ entity, groupId }) => [
      entity.id,
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
      getTableGroupDrops(store.state, held).map(({ entity, groupId, box }) => [
        entity.id,
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
      getTableGroupDrops(store.state).map(({ entity, box }) => [entity.id, box])
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

  it('judges each selected memo by its centre after the tables, each box read without it', () => {
    store.dispatchSync(
      addMemoAction({ id: 'noteHigh', ui: { x: 40, y: 200, zIndex: 9 } }),
      addMemoAction({ id: 'noteOut', ui: { x: 1200, y: 1000, zIndex: 9 } }),
      changeMemoGroupAction({ id: 'noteOut', value: 'low' }),
      selectAction({
        inLow: SelectType.table,
        noteHigh: SelectType.memo,
        noteOut: SelectType.memo,
      })
    );

    expect(
      getTableGroupDrops(store.state).map(({ kind, entity, groupId }) => [
        kind,
        entity.id,
        groupId,
      ])
    ).toEqual([
      ['table', 'inLow', 'low'],
      ['memo', 'noteHigh', 'high'],
      ['memo', 'noteOut', ''],
    ]);
  });

  it('judges a memo alone, but none while memos are hidden, nor one its selected group carries', () => {
    store.dispatchSync(
      addMemoAction({ id: 'note', ui: { x: 40, y: 200, zIndex: 9 } }),
      addMemoAction({ id: 'carried', ui: { x: 2100, y: 200, zIndex: 9 } }),
      changeMemoGroupAction({ id: 'carried', value: 'far' }),
      selectAction({ note: SelectType.memo })
    );
    expect(drops()).toEqual([['note', 'high']]);

    store.dispatchSync(
      selectAction({ far: SelectType.tableGroup, carried: SelectType.memo })
    );
    expect(drops()).toEqual([['note', 'high']]);

    store.dispatchSync(hideMemos);
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

  it('moves the memos whose group changes as it moves tables, tagged with the group each held', () => {
    store.dispatchSync(
      unselectAllAction(),
      addMemoAction({ id: 'noteJoins', ui: { x: 40, y: 200, zIndex: 2 } }),
      addMemoAction({ id: 'noteStays', ui: { x: 300, y: 200, zIndex: 2 } }),
      addMemoAction({ id: 'noteLeaves', ui: { x: 1200, y: 1000, zIndex: 2 } }),
      changeMemoGroupAction({ id: 'noteStays', value: 'g1' }),
      changeMemoGroupAction({ id: 'noteLeaves', value: 'g1' }),
      selectAction({
        noteJoins: SelectType.memo,
        noteStays: SelectType.memo,
        noteLeaves: SelectType.memo,
      })
    );

    expect(flatten(store, dropTablesIntoGroupsAction$())).toEqual([
      attachActionTag(
        Tag.drag,
        changeMemoGroupAction({ id: 'noteJoins', value: 'g1', prevValue: '' })
      ),
      attachActionTag(
        Tag.drag,
        changeMemoGroupAction({
          id: 'noteLeaves',
          value: '',
          prevValue: 'g1',
        })
      ),
    ]);
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

  it('raises its tables over every other table and memo, in their own order', () => {
    store.dispatchSync(
      addTableAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 7 } }),
      addTableAction({ id: 'm2', ui: { x: 0, y: 0, zIndex: 3 } }),
      addMemoAction({ id: 'note', ui: { x: 0, y: 0, zIndex: 50 } }),
      changeTableGroupAction({ id: 'm1', value: 'g2' }),
      changeTableGroupAction({ id: 'm2', value: 'g2' })
    );

    store.dispatchSync(selectTableGroupAction$('g2', false));

    const zIndexOf = (id: string) =>
      store.state.collections.tableEntities[id].ui.zIndex;
    expect([zIndexOf('m2'), zIndexOf('m1')]).toEqual([51, 52]);
    expect(zIndexOf('t1')).toBe(40);
  });

  it('raises its memos with its tables over every other table and memo, a table first on a tie', () => {
    store.dispatchSync(
      addTableAction({ id: 'member', ui: { x: 0, y: 0, zIndex: 5 } }),
      addMemoAction({ id: 'note', ui: { x: 0, y: 0, zIndex: 5 } }),
      addMemoAction({ id: 'early', ui: { x: 0, y: 0, zIndex: 3 } }),
      addMemoAction({ id: 'other', ui: { x: 0, y: 0, zIndex: 60 } }),
      changeTableGroupAction({ id: 'member', value: 'g2' }),
      changeMemoGroupAction({ id: 'note', value: 'g2' }),
      changeMemoGroupAction({ id: 'early', value: 'g2' })
    );

    store.dispatchSync(selectTableGroupAction$('g2', false));

    const { tableEntities, memoEntities } = store.state.collections;
    expect([
      memoEntities.early.ui.zIndex,
      tableEntities.member.ui.zIndex,
      memoEntities.note.ui.zIndex,
    ]).toEqual([61, 62, 63]);
    expect(memoEntities.other.ui.zIndex).toBe(60);
    expect(tableEntities.t1.ui.zIndex).toBe(40);
  });

  it('sends no z-index change once its tables stand over the rest', () => {
    store.dispatchSync(
      addTableAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 41 } }),
      changeTableGroupAction({ id: 'm1', value: 'g2' })
    );

    expect(typesOf(store, selectTableGroupAction$('g2', false))).not.toContain(
      'table.changeZIndex'
    );
    expect(store.state.collections.tableEntities.m1.ui.zIndex).toBe(41);
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

  it("selects the group's memos with its tables, while memos are shown", () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 6 } }),
      addMemoAction({ id: 'm2', ui: { x: 0, y: 0, zIndex: 7 } }),
      changeMemoGroupAction({ id: 'm1', value: 'g1' }),
      changeMemoGroupAction({ id: 'm2', value: 'g2' })
    );

    store.dispatchSync(selectTableGroupTablesAction$('g1'));
    expect(store.state.editor.selectedMap).toEqual({
      a: SelectType.table,
      b: SelectType.table,
      m1: SelectType.memo,
    });

    store.dispatchSync(hideMemos);
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

  it('brings back a removed group with its member memos in one undo', () => {
    rxStore.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addMemoAction({ id: 'm1', ui: { x: 100, y: 100, zIndex: 2 } }),
      changeMemoGroupAction({ id: 'm1', value: 'g1' }),
      changeTableGroupAction({ id: 't1', value: 'g1' })
    );
    vi.advanceTimersByTime(300);
    const size = rxStore.history.size;

    rxStore.dispatchSync(removeTableGroupAction$('g1'));
    vi.advanceTimersByTime(300);

    expect(rxStore.history.size).toBe(size + 1);
    expect(memoGroupIdOf(rxStore, 'm1')).toBe('');

    rxStore.undo();

    expect(rxStore.state.doc.tableGroupIds).toEqual(['g1']);
    expect(memoGroupIdOf(rxStore, 'm1')).toBe('g1');
    expect(groupIdOf(rxStore, 't1')).toBe('g1');
  });

  it('brings back a removed member memo in its group with one undo', () => {
    rxStore.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addMemoAction({ id: 'm1', ui: { x: 100, y: 100, zIndex: 2 } }),
      changeMemoGroupAction({ id: 'm1', value: 'g1' })
    );
    vi.advanceTimersByTime(300);
    const size = rxStore.history.size;

    rxStore.dispatchSync(removeMemoAction$('m1'));
    vi.advanceTimersByTime(300);

    expect(rxStore.history.size).toBe(size + 1);
    expect(rxStore.state.doc.memoIds).toEqual([]);

    rxStore.undo();

    expect(rxStore.state.doc.memoIds).toEqual(['m1']);
    expect(memoGroupIdOf(rxStore, 'm1')).toBe('g1');
  });

  it('takes back a memo drag and the group its drop joined in one undo', () => {
    rxStore.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: { ...UI, x: 1000 } }),
      addMemoAction({ id: 'm1', ui: { x: 100, y: 100, zIndex: 2 } }),
      selectAction({ m1: SelectType.memo })
    );
    vi.advanceTimersByTime(300);
    const size = rxStore.history.size;

    rxStore.dispatchSync(moveAllAction$(500, 0));
    rxStore.dispatchSync(moveAllAction$(500, 0));
    rxStore.dispatchSync(dropTablesIntoGroupsAction$());
    vi.advanceTimersByTime(300);

    expect(memoGroupIdOf(rxStore, 'm1')).toBe('g1');
    expect(rxStore.history.size).toBe(size + 1);

    rxStore.undo();

    expect(memoGroupIdOf(rxStore, 'm1')).toBe('');
    expect(rxStore.state.collections.memoEntities.m1.ui.x).toBe(100);

    rxStore.redo();

    expect(memoGroupIdOf(rxStore, 'm1')).toBe('g1');
    expect(rxStore.state.collections.memoEntities.m1.ui.x).toBe(1100);
  });

  it('takes back a group drag carrying a member memo in one undo', () => {
    rxStore.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addMemoAction({ id: 'm1', ui: { x: 100, y: 100, zIndex: 2 } }),
      changeMemoGroupAction({ id: 'm1', value: 'g1' }),
      selectAction({ g1: SelectType.tableGroup, m1: SelectType.memo })
    );
    vi.advanceTimersByTime(300);
    const size = rxStore.history.size;

    rxStore.dispatchSync(moveAllAction$(30, 0));
    rxStore.dispatchSync(moveAllAction$(30, 0));
    vi.advanceTimersByTime(300);

    expect(rxStore.history.size).toBe(size + 1);
    expect(rxStore.state.collections.memoEntities.m1.ui.x).toBe(160);

    rxStore.undo();

    expect(rxStore.state.collections.tableGroupEntities.g1.ui.x).toBe(0);
    expect(rxStore.state.collections.memoEntities.m1.ui.x).toBe(100);
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
