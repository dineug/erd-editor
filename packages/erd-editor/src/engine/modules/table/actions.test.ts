import { describe, expect, it } from 'vitest';

import { ActionType } from '@/engine/modules/table/actions';
import { actions, tableReducers } from '@/engine/modules/table/atom.actions';

describe('table/actions', () => {
  it('keeps the wire format of every action type stable', () => {
    expect(ActionType).toEqual({
      addTable: 'table.add',
      moveTable: 'table.move',
      moveToTable: 'table.moveTo',
      removeTable: 'table.remove',
      changeTableName: 'table.changeName',
      changeTableComment: 'table.changeComment',
      changeTableColor: 'table.changeColor',
      changeZIndex: 'table.changeZIndex',
      sortTable: 'table.sort',
    });
  });

  it('namespaces every action type under "table."', () => {
    const values = Object.values(ActionType);
    expect(values.length).toBe(9);

    for (const type of values) {
      expect(type.startsWith('table.')).toBe(true);
    }
  });

  it('has unique action types', () => {
    const values = Object.values(ActionType);
    expect(new Set(values).size).toBe(values.length);
  });

  it('exposes a reducer for every action type', () => {
    for (const type of Object.values(ActionType)) {
      expect(typeof Reflect.get(tableReducers, type)).toBe('function');
    }
    expect(Object.keys(tableReducers).slice().sort()).toEqual(
      Object.values(ActionType).slice().sort()
    );
  });

  it('exposes an action creator for every action type', () => {
    const createdTypes = Object.values(actions).map(
      actionCreator => (actionCreator as any).type
    );
    expect(createdTypes.slice().sort()).toEqual(
      Object.values(ActionType).slice().sort()
    );
  });

  it('builds actions carrying the matching type and payload', () => {
    const action = actions.moveTableAction({
      ids: ['a', 'b'],
      movementX: 1,
      movementY: 2,
    });

    expect(action.type).toBe(ActionType.moveTable);
    expect(action.payload).toEqual({
      ids: ['a', 'b'],
      movementX: 1,
      movementY: 2,
    });
    expect(`${actions.moveTableAction}`).toBe(ActionType.moveTable);
  });

  it('builds a void payload action for sortTable', () => {
    const action = (actions.sortTableAction as any)();

    expect(action.type).toBe(ActionType.sortTable);
    expect(action.payload).toBeUndefined();
  });
});
