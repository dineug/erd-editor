import { describe, expect, it } from 'vite-plus/test';

import { ActionType } from '@/engine/modules/index-column/actions';
import {
  actions,
  indexColumnReducers,
} from '@/engine/modules/index-column/atom.actions';
import { indexColumnPushUndoHistoryMap } from '@/engine/modules/index-column/history';

describe('index-column ActionType', () => {
  it('namespaces every action type under `indexColumn.`', () => {
    expect(ActionType).toEqual({
      addIndexColumn: 'indexColumn.add',
      removeIndexColumn: 'indexColumn.remove',
      moveIndexColumn: 'indexColumn.move',
      changeIndexColumnOrderType: 'indexColumn.changeOrderType',
    });

    for (const type of Object.values(ActionType)) {
      expect(type.startsWith('indexColumn.')).toBe(true);
    }
  });

  it('keeps every action type unique', () => {
    const types = Object.values(ActionType);

    expect(new Set(types).size).toBe(types.length);
  });

  it('has a reducer registered for every action type', () => {
    expect(Object.keys(indexColumnReducers).sort()).toEqual(
      Object.values(ActionType).sort()
    );

    for (const type of Object.values(ActionType)) {
      expect(typeof Reflect.get(indexColumnReducers, type)).toBe('function');
    }
  });

  it('has an undo handler registered for every action type', () => {
    expect(Object.keys(indexColumnPushUndoHistoryMap).sort()).toEqual(
      Object.values(ActionType).sort()
    );
  });

  it('has an action creator whose type matches every action type', () => {
    const creatorTypes = Object.values(actions).map(creator => creator.type);

    expect(creatorTypes.sort()).toEqual(Object.values(ActionType).sort());
  });
});
