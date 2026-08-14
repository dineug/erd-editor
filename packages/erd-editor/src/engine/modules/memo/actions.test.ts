import { describe, expect, it } from 'vitest';

import { ActionType } from '@/engine/modules/memo/actions';
import { actions, memoReducers } from '@/engine/modules/memo/atom.actions';

describe('memo/actions', () => {
  it('namespaces every action type under "memo."', () => {
    const types = Object.values(ActionType);

    expect(types.length).toBe(8);
    for (const type of types) {
      expect(type.startsWith('memo.')).toBe(true);
    }
  });

  it('exposes the exact action type strings the persisted protocol relies on', () => {
    expect(ActionType).toEqual({
      addMemo: 'memo.add',
      moveMemo: 'memo.move',
      moveToMemo: 'memo.moveTo',
      removeMemo: 'memo.remove',
      changeMemoValue: 'memo.changeValue',
      changeMemoColor: 'memo.changeColor',
      resizeMemo: 'memo.resize',
      changeZIndex: 'memo.changeZIndex',
    });
  });

  it('keeps every action type unique', () => {
    const types = Object.values(ActionType);

    expect(new Set(types).size).toBe(types.length);
  });

  it('has a reducer registered for every action type', () => {
    expect(Object.keys(memoReducers).sort()).toEqual(
      Object.values(ActionType).sort()
    );
  });

  it('has an action creator whose type matches each action type', () => {
    const creatorTypes = Object.values(actions).map(creator => creator.type);

    expect(creatorTypes.sort()).toEqual(Object.values(ActionType).sort());
  });
});
