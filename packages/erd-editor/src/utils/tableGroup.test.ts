import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  TABLE_GROUP_PADDING,
  TABLE_GROUP_TITLE_HEIGHT,
} from '@/constants/layout';
import { Show } from '@/constants/schema';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { getTableRect } from '@/konva/scene/metrics';
import { createTable } from '@/utils/collection/table.entity';
import { createTableGroup } from '@/utils/collection/tableGroup.entity';
import {
  findTableGroupAt,
  findTableGroupsAt,
  getTableCenter,
  getTableGroupColors,
  getTableGroupId,
  getTableGroupMemberIds,
  getTableGroupMembers,
  getTableGroupRect,
  getTableGroupRects,
  getTableGroupTint,
  getTableGroupWraps,
  getTableHeaderTint,
  getTablesGroupRect,
  isPointInRect,
  isTableGroupShown,
  nextTableGroupZIndex,
  padRect,
} from '@/utils/tableGroup';

const P = TABLE_GROUP_PADDING;

/** The padding over a box's top edge, where the title bar sits above the padding. */
const TOP = TABLE_GROUP_PADDING + TABLE_GROUP_TITLE_HEIGHT;

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
  ui: { x: number; y: number; width: number; height: number; zIndex?: number },
  color = ''
) {
  const group = createTableGroup({ id, color, ui: { zIndex: 1, ...ui } });
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
  it('grows a rect by the padding on every side and the title bar on top', () => {
    expect(TOP).toBe(52);
    expect(padRect({ x: 10, y: 20, width: 100, height: 50 })).toEqual({
      x: 10 - P,
      y: 20 - TOP,
      width: 100 + P * 2,
      height: 50 + P + TOP,
    });
    expect(padRect({ x: 0, y: 0, width: 1, height: 1 }, 5)).toEqual({
      x: -5,
      y: -33,
      width: 11,
      height: 39,
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

  it('keeps the title bar clear above a member that reaches past the top', () => {
    const state = createState();
    const group = addGroup(state, 'g1', {
      x: 0,
      y: 100,
      width: 500,
      height: 500,
    });
    addTable(state, 't1', 100, 110, 'g1');

    const box = getTableGroupRect(state, group);

    expect(box.y).toBe(110 - TOP);
    expect(110 - box.y - TABLE_GROUP_TITLE_HEIGHT).toBe(P);
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

describe('getTableGroupRect with its members handed in', () => {
  it('reads the members given and walks no table of the document', () => {
    const state = createState();
    const group = addGroup(state, 'g1', { x: 0, y: 0, width: 50, height: 50 });
    const member = addTable(state, 't1', 400, 400, 'g1');
    addTable(state, 't2', 900, 900, 'g1');

    expect(getTableGroupRect(state, group, { members: [member] })).toEqual(
      getTableGroupRect(state, group, { excludeTableIds: ['t2'] })
    );
    expect(
      getTableGroupRect(state, group, {
        members: [member],
        excludeTableIds: ['t1'],
      })
    ).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });
});

describe('getTableGroupRects', () => {
  it('reads every listed group as getTableGroupRect does, out of one walk', () => {
    const state = createState();
    const g1 = addGroup(state, 'g1', { x: 0, y: 0, width: 50, height: 50 });
    const g2 = addGroup(state, 'g2', { x: 600, y: 0, width: 50, height: 50 });
    addTable(state, 'a', 300, 300, 'g1');
    addTable(state, 'b', 900, 300, 'g2');
    addTable(state, 'c', 100, 900, 'g2');
    addTable(state, 'stale', -900, -900, 'ghost');
    addTable(state, 'loose', -900, -900);

    expect(getTableGroupRects(state)).toEqual(
      new Map([
        ['g1', getTableGroupRect(state, g1)],
        ['g2', getTableGroupRect(state, g2)],
      ])
    );
    expect(
      getTableGroupRects(state, { excludeTableIds: ['b', 'c'] }).get('g2')
    ).toEqual({ x: 600, y: 0, width: 50, height: 50 });
  });

  it('reads no group the document does not list, and none in a document with none', () => {
    const state = createState();
    addGroup(state, 'g1', { x: 0, y: 0, width: 50, height: 50 });
    addTable(state, 'a', 300, 300, 'g1');
    state.doc.tableGroupIds = [];

    expect(getTableGroupRects(state).size).toBe(0);
  });
});

describe('getTableGroupMembers', () => {
  it('lists each listed group its member tables in document order, a group with none left out', () => {
    const state = createState();
    addGroup(state, 'g1', { x: 0, y: 0, width: 50, height: 50 });
    addGroup(state, 'g2', { x: 0, y: 0, width: 50, height: 50 });
    addGroup(state, 'empty', { x: 0, y: 0, width: 50, height: 50 });
    const b = addTable(state, 'b', 0, 0, 'g1');
    const a = addTable(state, 'a', 0, 0, 'g2');
    const c = addTable(state, 'c', 0, 0, 'g1');
    addTable(state, 'stale', 0, 0, 'ghost');
    addTable(state, 'loose', 0, 0);

    expect(getTableGroupMembers(state)).toEqual(
      new Map([
        ['g1', [b, c]],
        ['g2', [a]],
      ])
    );
  });

  it('lists nothing in a document with no group', () => {
    const state = createState();
    addTable(state, 'a', 0, 0, 'ghost');

    expect(getTableGroupMembers(state).size).toBe(0);
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
      y: a.y - TOP,
      width: b.x + b.width - a.x + P * 2,
      height: b.y + b.height - a.y + P + TOP,
    });
  });

  it('is null for no table the document lists', () => {
    expect(getTablesGroupRect(createState(), ['ghost'])).toBeNull();
    expect(getTablesGroupRect(createState(), [])).toBeNull();
  });
});

describe('getTableGroupWraps', () => {
  it('wraps each group with members round them, a named table at its point', () => {
    const state = createState();
    addGroup(state, 'g1', { x: -900, y: -900, width: 2000, height: 2000 });
    const a = getTableRect(state, addTable(state, 'a', 100, 100, 'g1'));
    const b = getTableRect(state, addTable(state, 'b', 500, 300, 'g1'));
    addTable(state, 'loose', 0, 0);

    expect(getTableGroupWraps(state, [{ id: 'a', x: 700, y: 400 }])).toEqual([
      {
        id: 'g1',
        x: b.x - P,
        y: b.y - TOP,
        width: 700 + a.width - b.x + P * 2,
        height: 400 + a.height - b.y + P + TOP,
      },
    ]);
  });

  it('wraps the members where they stand when no point is named', () => {
    const state = createState();
    addGroup(state, 'g1', { x: 0, y: 0, width: 10, height: 10 });
    const a = getTableRect(state, addTable(state, 'a', 100, 100, 'g1'));

    expect(getTableGroupWraps(state)).toEqual([{ id: 'g1', ...padRect(a) }]);
  });

  it('leaves out a group with no member and a groupId naming no group', () => {
    const state = createState();
    addGroup(state, 'empty', { x: 0, y: 0, width: 10, height: 10 });
    addTable(state, 'a', 100, 100, 'ghost');

    expect(getTableGroupWraps(state, [{ id: 'a', x: 0, y: 0 }])).toEqual([]);
  });

  it('answers the groups in the order the document lists them', () => {
    const state = createState();
    addGroup(state, 'g2', { x: 0, y: 0, width: 10, height: 10 });
    addGroup(state, 'g1', { x: 0, y: 0, width: 10, height: 10 });
    addTable(state, 'a', 100, 100, 'g1');
    addTable(state, 'b', 500, 100, 'g2');

    expect(getTableGroupWraps(state).map(({ id }) => id)).toEqual(['g2', 'g1']);
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

describe('findTableGroupsAt', () => {
  it('answers each point as findTableGroupAt does, in order', () => {
    const state = createState();
    addGroup(state, 'high', { x: 0, y: 0, width: 100, height: 100, zIndex: 5 });
    addGroup(state, 'low', { x: 0, y: 0, width: 300, height: 100, zIndex: 2 });
    addGroup(state, 'g1', { x: 0, y: 200, width: 50, height: 50 });
    const table = addTable(state, 't1', 400, 400, 'g1');
    const points = [
      { x: 50, y: 50 },
      { x: 250, y: 50 },
      { x: 500, y: 500 },
      getTableCenter(state, table),
    ];

    expect(
      findTableGroupsAt(state, points, { excludeTableIds: ['t1'] }).map(
        group => group?.id ?? null
      )
    ).toEqual(['high', 'low', null, null]);
    expect(findTableGroupsAt(state, [])).toEqual([]);
  });

  it('reads the boxes handed in over the ones the tables would build', () => {
    const state = createState();
    addGroup(state, 'g1', { x: 0, y: 0, width: 100, height: 100 });
    addGroup(state, 'g2', { x: 500, y: 0, width: 100, height: 100 });
    const boxes = new Map([['g1', { x: 0, y: 0, width: 1000, height: 100 }]]);

    expect(
      findTableGroupsAt(state, [{ x: 550, y: 50 }], { boxes }).map(
        group => group?.id ?? null
      )
    ).toEqual(['g1']);
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

describe('isTableGroupShown', () => {
  it('shows groups until the hide bit is set', () => {
    const state = createState();

    expect(isTableGroupShown(state)).toBe(true);

    state.settings.show |= Show.hideTableGroup;
    expect(isTableGroupShown(state)).toBe(false);
  });
});

describe('getTableGroupColors', () => {
  it('paints with the color as an opaque hex and the text that contrasts with it', () => {
    expect(getTableGroupColors(createTableGroup({ color: '#1E3A8A' }))).toEqual(
      { background: '#1e3a8a', foreground: '#ffffff' }
    );
    expect(
      getTableGroupColors(createTableGroup({ color: 'rgb(254 240 138 / 50%)' }))
    ).toEqual({ background: '#fef08a', foreground: '#000000' });
  });

  it('is null for no color and for one it cannot read', () => {
    expect(getTableGroupColors(createTableGroup({ color: '' }))).toBeNull();
    expect(getTableGroupColors(createTableGroup({ color: 'red' }))).toBeNull();
  });
});

describe('getTableGroupTint', () => {
  const box = { x: 0, y: 0, width: 10, height: 10 };

  it('paints the group named, in the document while groups show', () => {
    const state = createState();
    addGroup(state, 'g1', box, '#000000');

    expect(getTableGroupTint(state, 'g1')).toEqual({
      background: '#000000',
      foreground: '#ffffff',
    });
    expect(getTableGroupTint(state, '')).toBeNull();
    expect(getTableGroupTint(state, 'ghost')).toBeNull();
    expect(getTableGroupTint(state, 'g1', 'flow')).toBeNull();

    state.settings.show |= Show.hideTableGroup;
    expect(getTableGroupTint(state, 'g1')).toBeNull();
  });
});

describe('getTableHeaderTint', () => {
  const box = { x: 0, y: 0, width: 10, height: 10 };

  it('tints a member of a colored group in the document', () => {
    const state = createState();
    addGroup(state, 'g1', box, '#000000');
    const table = addTable(state, 't1', 0, 0, 'g1');

    expect(getTableHeaderTint(state, table)).toEqual({
      background: '#000000',
      foreground: '#ffffff',
    });
  });

  it('tints nothing in a view, while groups are hidden, or out of any group', () => {
    const state = createState();
    addGroup(state, 'g1', box, '#000000');
    const member = addTable(state, 't1', 0, 0, 'g1');
    const loose = addTable(state, 't2', 0, 0);
    const stale = addTable(state, 't3', 0, 0, 'ghost');

    expect(getTableHeaderTint(state, member, 'flow')).toBeNull();
    expect(getTableHeaderTint(state, loose)).toBeNull();
    expect(getTableHeaderTint(state, stale)).toBeNull();

    state.settings.show |= Show.hideTableGroup;
    expect(getTableHeaderTint(state, member)).toBeNull();
  });

  it('tints nothing for a group with no color it can read', () => {
    const state = createState();
    addGroup(state, 'plain', box);
    addGroup(state, 'named', box, 'tomato');

    expect(
      getTableHeaderTint(state, addTable(state, 't1', 0, 0, 'plain'))
    ).toBeNull();
    expect(
      getTableHeaderTint(state, addTable(state, 't2', 0, 0, 'named'))
    ).toBeNull();
  });
});
