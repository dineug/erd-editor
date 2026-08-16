import { describe, expect, it } from 'vite-plus/test';

import { ActionType } from '@/engine/modules/index/actions';
import { actions, indexReducers } from '@/engine/modules/index/atom.actions';
import { indexPushUndoHistoryMap } from '@/engine/modules/index/history';

describe('index ActionType', () => {
  it('namespaces every action type under `index.`', () => {
    expect(ActionType).toEqual({
      addIndex: 'index.add',
      removeIndex: 'index.remove',
      changeIndexName: 'index.changeName',
      changeIndexUnique: 'index.changeUnique',
    });

    for (const type of Object.values(ActionType)) {
      expect(type.startsWith('index.')).toBe(true);
    }
  });

  it('keeps every action type unique', () => {
    const types = Object.values(ActionType);

    expect(new Set(types).size).toBe(types.length);
  });

  it('has a reducer registered for every action type', () => {
    expect(Object.keys(indexReducers).sort()).toEqual(
      Object.values(ActionType).sort()
    );

    for (const type of Object.values(ActionType)) {
      expect(typeof Reflect.get(indexReducers, type)).toBe('function');
    }
  });

  it('has an undo handler registered for every action type', () => {
    expect(Object.keys(indexPushUndoHistoryMap).sort()).toEqual(
      Object.values(ActionType).sort()
    );
  });

  it('has an action creator whose type matches every action type', () => {
    const creatorTypes = Object.values(actions).map(creator => creator.type);

    expect(creatorTypes.sort()).toEqual(Object.values(ActionType).sort());
  });
});
