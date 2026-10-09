import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { TABLE_GROUP_PADDING } from '@/constants/layout';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { getTableRect } from '@/konva/scene/metrics';
import { createTable } from '@/utils/collection/table.entity';
import { createTableGroup } from '@/utils/collection/tableGroup.entity';
import {
  findTableGroupAt,
  getTableCenter,
  getTableGroupId,
  getTableGroupMemberIds,
  getTableGroupRect,
  getTablesGroupRect,
  isPointInRect,
  nextTableGroupZIndex,
  padRect,
} from '@/utils/tableGroup';

const P = TABLE_GROUP_PADDING;

function createState(): RootState {
  return { ...schemaV3Parser({}), editor: createEditor(), lww: {} };
}

function addTable(
  state: RootState,
  id: string,
  x: number,
  y: number,
  groupId = ''
) {
  const table = createTable({ id, name: id, groupId, ui: { x, y } });
  state.collections.tableEntities[id] = table;
  state.doc.tableIds.push(id);
  return table;
}

function addGroup(
  state: RootState,
  id: string,
  ui: { x: number; y: number; width: number; height: number; zIndex?: number }
) {
  const group = createTableGroup({ id, ui: { zIndex: 1, ...ui } });
  state.collections.tableGroupEntities[id] = group;
  state.doc.tableGroupIds.push(id);
  return group;
}

describe('getTableGroupId', () => {
  it('reads a group the document lists', () => {
    const state = createState();
    addGroup(state, 'g1', { x: 0, y: 0, width: 10, height: 10 });

    expect(getTableGroupId(state, addTable(state, 't1', 0, 0, 'g1'))).toBe(
      'g1'
    );
  });

  it('reads none for no group, a removed group and an id no group has', () => {
    const state = createState();
    const removed = addGroup(state, 'g1', { x: 0, y: 0, width: 1, height: 1 });
    state.doc.tableGroupIds = [];

    expect(getTableGroupId(state, addTable(state, 't1', 0, 0))).toBe('');
    expect(
      getTableGroupId(state, addTable(state, 't2', 0, 0, removed.id))
    ).toBe('');
    expect(getTableGroupId(state, addTable(state, 't3', 0, 0, 'ghost'))).toBe(
      ''
    );
  });
});

describe('getTableGroupMemberIds', () => {
  it('lists the tables in the document that name the group, in document order', () => {
    const state = createState();
    addGroup(state, 'g1', { x: 0, y: 0, width: 10, height: 10 });
    addTable(state, 'b', 0, 0, 'g1');
    addTable(state, 'a', 0, 0, 'g1');
    addTable(state, 'c', 0, 0, 'g2');
    addTable(state, 'removed', 0, 0, 'g1');
    state.doc.tableIds = ['b', 'a', 'c'];

    expect(getTableGroupMemberIds(state, 'g1')).toEqual(['b', 'a']);
  });

  it('lists none for a group the document does not list, or for no group', () => {
    const state = createState();
    addTable(state, 't1', 0, 0, 'ghost');
    addTable(state, 't2', 0, 0);

    expect(getTableGroupMemberIds(state, 'ghost')).toEqual([]);
    expect(getTableGroupMemberIds(state, '')).toEqual([]);
  });
});

describe('padRect', () => {
  it('grows a rect by the padding on every side', () => {
    expect(padRect({ x: 10, y: 20, width: 100, height: 50 })).toEqual({
      x: 10 - P,
      y: 20 - P,
      width: 100 + P * 2,
      height: 50 + P * 2,
    });
    expect(padRect({ x: 0, y: 0, width: 1, height: 1 }, 5)).toEqual({
      x: -5,
      y: -5,
      width: 11,
      height: 11,
    });
  });
});

describe('getTableGroupRect', () => {
  it('is the stored rect while no member reaches past it', () => {
    const state = createState();
    const group = addGroup(state, 'g1', {
      x: -100,
      y: -100,
      width: 2000,
      height: 2000,
    });
    addTable(state, 't1', 100, 100, 'g1');

    expect(getTableGroupRect(state, group)).toEqual({
      x: -100,
      y: -100,
      width: 2000,
      height: 2000,
    });
  });

  it('reaches over each member that grows past the stored rect, padded', () => {
    const state = createState();
    const group = addGroup(state, 'g1', { x: 0, y: 0, width: 50, height: 50 });
    const table = addTable(state, 't1', 300, 400, 'g1');
    const rect = getTableRect(state, table);

    expect(getTableGroupRect(state, group)).toEqual({
      x: 0,
      y: 0,
      width: rect.x + rect.width + P,
      height: rect.y + rect.height + P,
    });
  });

  it('leaves out the tables a drag holds, and tables of other groups', () => {
    const state = createState();
    const group = addGroup(state, 'g1', { x: 0, y: 0, width: 50, height: 50 });
    addTable(state, 'dragged', 900, 900, 'g1');
    addTable(state, 'other', 600, 600, 'g2');

    expect(
      getTableGroupRect(state, group, { excludeTableIds: ['dragged'] })
    ).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });
});

describe('getTablesGroupRect', () => {
  it('is the bounds of the tables the document lists, padded', () => {
    const state = createState();
    const a = getTableRect(state, addTable(state, 'a', 100, 100));
    const b = getTableRect(state, addTable(state, 'b', 500, 300));
    addTable(state, 'removed', -900, -900);
    state.doc.tableIds = ['a', 'b'];

    expect(getTablesGroupRect(state, ['a', 'b', 'removed', 'ghost'])).toEqual({
      x: a.x - P,
      y: a.y - P,
      width: b.x + b.width - a.x + P * 2,
      height: b.y + b.height - a.y + P * 2,
    });
  });

  it('is null for no table the document lists', () => {
    expect(getTablesGroupRect(createState(), ['ghost'])).toBeNull();
    expect(getTablesGroupRect(createState(), [])).toBeNull();
  });
});

describe('getTableCenter', () => {
  it('is the middle of the table box', () => {
    const state = createState();
    const table = addTable(state, 't1', 100, 200);
    const { width, height } = getTableRect(state, table);

    expect(getTableCenter(state, table)).toEqual({
      x: 100 + width / 2,
      y: 200 + height / 2,
    });
  });
});

describe('isPointInRect', () => {
  const rect = { x: 0, y: 0, width: 10, height: 10 };

  it.each([
    [{ x: 5, y: 5 }, true],
    [{ x: 0, y: 0 }, true],
    [{ x: 10, y: 10 }, true],
    [{ x: -0.1, y: 5 }, false],
    [{ x: 5, y: 10.1 }, false],
    [{ x: 11, y: 5 }, false],
    [{ x: 5, y: -1 }, false],
  ])('reads %o as %s, the edges inside', (point, inside) => {
    expect(isPointInRect(point, rect)).toBe(inside);
  });
});

describe('findTableGroupAt', () => {
  it('finds the group whose box holds the point', () => {
    const state = createState();
    addGroup(state, 'g1', { x: 0, y: 0, width: 100, height: 100 });
    addGroup(state, 'g2', { x: 500, y: 0, width: 100, height: 100 });

    expect(findTableGroupAt(state, { x: 550, y: 50 })?.id).toBe('g2');
    expect(findTableGroupAt(state, { x: 300, y: 50 })).toBeNull();
  });

  it('takes the topmost of overlapping groups, the later on a tie', () => {
    const state = createState();
    addGroup(state, 'high', { x: 0, y: 0, width: 100, height: 100, zIndex: 5 });
    addGroup(state, 'low', { x: 0, y: 0, width: 100, height: 100, zIndex: 2 });
    addGroup(state, 'tieA', { x: 200, y: 0, width: 50, height: 50 });
    addGroup(state, 'tieB', { x: 200, y: 0, width: 50, height: 50 });

    expect(findTableGroupAt(state, { x: 50, y: 50 })?.id).toBe('high');
    expect(findTableGroupAt(state, { x: 225, y: 25 })?.id).toBe('tieB');
  });

  it('reads the box a member stretches, unless the member is left out', () => {
    const state = createState();
    addGroup(state, 'g1', { x: 0, y: 0, width: 50, height: 50 });
    const table = addTable(state, 't1', 400, 400, 'g1');
    const center = getTableCenter(state, table);

    expect(findTableGroupAt(state, center)?.id).toBe('g1');
    expect(
      findTableGroupAt(state, center, { excludeTableIds: ['t1'] })
    ).toBeNull();
  });

  it('never finds a group the document does not list', () => {
    const state = createState();
    addGroup(state, 'g1', { x: 0, y: 0, width: 100, height: 100 });
    state.doc.tableGroupIds = [];

    expect(findTableGroupAt(state, { x: 50, y: 50 })).toBeNull();
  });
});

describe('nextTableGroupZIndex', () => {
  it('lifts over the highest group, starting at 1', () => {
    expect(nextTableGroupZIndex([])).toBe(1);
    expect(
      nextTableGroupZIndex([
        createTableGroup({ ui: { zIndex: 3 } }),
        createTableGroup({ ui: { zIndex: 7 } }),
      ])
    ).toBe(8);
  });
});
