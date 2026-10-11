import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { Show } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  selectAction,
  selectAllAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import {
  changeColorAllAction$,
  dragSelectAction$,
  duplicateAction$,
  moveAllAction$,
  type MoveAllGesture,
  pasteEntitiesAction$,
  removeColorAllAction$,
  removeSelectedAction$,
} from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  changeShowAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
} from '@/engine/modules/table/atom.actions';
import {
  addTableGroupAction,
  changeTableGroupColorAction,
} from '@/engine/modules/table-group/atom.actions';
import { createStore, Store } from '@/engine/store';
import { Tag } from '@/engine/tag';
import { bHas } from '@/utils/bit';
import { entitiesCopyToPayload } from '@/utils/table-clipboard/copy';
import { getTableGroupRects } from '@/utils/tableGroup';

const UI = { x: 0, y: 0, width: 800, height: 600, zIndex: 1 };

function createTestStore(): Store {
  return createStore({ toWidth: text => text.length * 10, clock: new Clock() });
}

function flatten(store: Store, action: any): AnyAction[] {
  return compositionActionsFlat(store.state, store.context, [action]);
}

let store: Store;

/**
 * A group holding two tables, a table outside it and a memo, the group drawn
 * round every table so a marquee or select all over it reaches the group too.
 */
beforeEach(() => {
  store = createTestStore();
  store.dispatchSync(
    addTableGroupAction({ id: 'g1', ui: UI }),
    addTableAction({ id: 'member', ui: { x: 100, y: 100, zIndex: 2 } }),
    addTableAction({ id: 'other', ui: { x: 100, y: 300, zIndex: 2 } }),
    addTableAction({ id: 'loose', ui: { x: 500, y: 100, zIndex: 2 } }),
    addMemoAction({ id: 'm1', ui: { x: 500, y: 300, zIndex: 2 } }),
    changeTableGroupAction({ id: 'member', value: 'g1' }),
    changeTableGroupAction({ id: 'other', value: 'g1' })
  );
});

const tableX = (id: string) => store.state.collections.tableEntities[id].ui.x;

describe('moveAllAction$ with a group selected', () => {
  it('moves the group and its members by the step the zoom scales', () => {
    store.dispatchSync(
      selectAction({ g1: SelectType.tableGroup }),
      changeZoomLevelAction({ value: 0.5 })
    );

    store.dispatchSync(moveAllAction$(10, 0));

    expect(store.state.collections.tableGroupEntities.g1.ui.x).toBe(20);
    expect(['member', 'other', 'loose'].map(tableX)).toEqual([120, 120, 500]);
  });

  it('moves a member selected beside its group once, and a selected table outside it too', () => {
    store.dispatchSync(
      selectAction({
        member: SelectType.table,
        g1: SelectType.tableGroup,
        loose: SelectType.table,
        m1: SelectType.memo,
      })
    );

    const actions = flatten(store, moveAllAction$(10, 0));

    expect(actions.map(({ type, payload }) => [type, payload.ids])).toEqual([
      ['tableGroup.move', ['g1']],
      ['table.move', ['member', 'loose', 'other']],
      ['memo.move', ['m1']],
    ]);
    expect(actions.every(({ tags }) => bHas(tags ?? 0, Tag.drag))).toBe(true);

    store.dispatchSync(moveAllAction$(10, 0));

    expect(['member', 'other', 'loose'].map(tableX)).toEqual([110, 110, 510]);
  });

  it('carries the tables its gesture read at the first step to the last, whatever joins or leaves the group', () => {
    store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));
    const gesture: MoveAllGesture = {};

    store.dispatchSync(moveAllAction$(10, 0, 'document', gesture));
    store.dispatchSync(
      changeTableGroupAction({ id: 'loose', value: 'g1' }),
      changeTableGroupAction({ id: 'other', value: '' })
    );
    const actions = flatten(store, moveAllAction$(10, 0, 'document', gesture));

    expect(gesture.tableIds).toEqual(['member', 'other']);
    expect(actions.map(({ type, payload }) => [type, payload.ids])).toEqual([
      ['tableGroup.move', ['g1']],
      ['table.move', ['member', 'other']],
    ]);
  });

  it('keeps carrying the group its gesture began with once the group leaves the selection midway', () => {
    store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));
    const gesture: MoveAllGesture = {};

    store.dispatchSync(moveAllAction$(10, 0, 'document', gesture));
    store.dispatchSync(unselectAllAction());
    store.dispatchSync(moveAllAction$(10, 0, 'document', gesture));

    expect(gesture.tableGroupIds).toEqual(['g1']);
    expect(store.state.collections.tableGroupEntities.g1.ui.x).toBe(20);
    expect(['member', 'other', 'loose'].map(tableX)).toEqual([120, 120, 500]);
  });

  it('moves no group from a view scene, which shows none', () => {
    store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));

    expect(flatten(store, moveAllAction$(10, 0, 'flow'))).toEqual([]);
  });
});

describe('removeSelectedAction$ with a group selected', () => {
  it('removes the selected group and clears its members, the tables staying', () => {
    store.dispatchSync(
      selectAction({ g1: SelectType.tableGroup, loose: SelectType.table })
    );

    store.dispatchSync(removeSelectedAction$());

    const { doc, collections } = store.state;
    expect(doc.tableGroupIds).toEqual([]);
    expect(doc.tableIds).toEqual(['member', 'other']);
    expect(collections.tableEntities.member.groupId).toBe('');
    expect(collections.tableEntities.other.groupId).toBe('');
  });
});

describe('the color picker over a selected group', () => {
  it('paints the group with the tables and memos, nothing for one already that color', () => {
    store.dispatchSync(
      selectAction({ g1: SelectType.tableGroup, loose: SelectType.table })
    );

    expect(
      flatten(store, changeColorAllAction$('#FF0000')).map(
        ({ type, payload }) => [type, payload]
      )
    ).toEqual([
      ['table.changeColor', { id: 'loose', color: '#FF0000', prevColor: '' }],
      ['tableGroup.changeColor', { id: 'g1', color: '#FF0000', prevColor: '' }],
    ]);

    store.dispatchSync(
      changeTableGroupColorAction({ id: 'g1', color: '#ff0000', prevColor: '' })
    );

    expect(
      flatten(store, changeColorAllAction$('#FF0000')).map(({ type }) => type)
    ).toEqual(['table.changeColor']);
  });

  it('clears the color of a colored group, and sends nothing for one without', () => {
    store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));

    expect(flatten(store, removeColorAllAction$())).toEqual([]);

    store.dispatchSync(
      changeTableGroupColorAction({ id: 'g1', color: '#00ff00', prevColor: '' })
    );
    store.dispatchSync(removeColorAllAction$());

    expect(store.state.collections.tableGroupEntities.g1.color).toBe('');
  });
});

describe('select all', () => {
  it('leaves groups out of select all', () => {
    store.dispatchSync(selectAllAction());

    expect(Object.values(store.state.editor.selectedMap)).not.toContain(
      SelectType.tableGroup
    );
    expect(Object.keys(store.state.editor.selectedMap).sort()).toEqual([
      'loose',
      'm1',
      'member',
      'other',
    ]);
  });
});

describe('a marquee over table groups', () => {
  it('takes a group whose whole box it encloses, beside its tables', () => {
    store.dispatchSync(
      dragSelectAction$({ x: -100, y: -100, w: 2000, h: 2000 })
    );

    expect(store.state.editor.selectedMap.g1).toBe(SelectType.tableGroup);
    expect(store.state.editor.selectedMap.member).toBe(SelectType.table);
  });

  it('takes no group it covers only in part, though it takes the tables inside', () => {
    const box = getTableGroupRects(store.state).get('g1')!;

    store.dispatchSync(
      dragSelectAction$({
        x: box.x + 10,
        y: box.y + 10,
        w: box.width + 500,
        h: box.height + 500,
      })
    );

    expect(store.state.editor.selectedMap).not.toHaveProperty('g1');
    expect(store.state.editor.selectedMap.member).toBe(SelectType.table);
  });

  it('takes a box exactly the size of the group, its edges included', () => {
    const box = getTableGroupRects(store.state).get('g1')!;

    store.dispatchSync(
      dragSelectAction$({ x: box.x, y: box.y, w: box.width, h: box.height })
    );

    expect(store.state.editor.selectedMap.g1).toBe(SelectType.tableGroup);
  });

  it('takes no group while groups are hidden', () => {
    store.dispatchSync(
      changeShowAction({ show: Show.hideTableGroup, value: true })
    );
    store.dispatchSync(
      dragSelectAction$({ x: -100, y: -100, w: 2000, h: 2000 })
    );

    expect(store.state.editor.selectedMap).not.toHaveProperty('g1');
  });
});

describe('duplicates of grouped tables', () => {
  it('make tables in no group, as a paste does', () => {
    store.dispatchSync(
      duplicateAction$({
        tableIds: ['member'],
        offset: { x: 50, y: 50 },
        escapeCollision: false,
      })
    );

    const { doc, collections } = store.state;
    const copy = collections.tableEntities[doc.tableIds[3]];
    expect(doc.tableIds).toHaveLength(4);
    expect(copy.groupId).toBe('');
    expect(doc.tableGroupIds).toEqual(['g1']);
  });
});

describe('pastes of grouped tables', () => {
  it('make tables in no group, since a paste is not a drag', () => {
    store.dispatchSync(
      selectAction({ member: SelectType.table, g1: SelectType.tableGroup })
    );
    const payload = entitiesCopyToPayload(store.state)!;

    store.dispatchSync(pasteEntitiesAction$(payload, 1));

    const { doc, collections } = store.state;
    const pasted = collections.tableEntities[doc.tableIds[3]];
    expect(doc.tableIds).toHaveLength(4);
    expect(pasted.groupId).toBe('');
    expect(doc.tableGroupIds).toEqual(['g1']);
  });
});
