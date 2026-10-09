import { describe, expect, it } from 'vite-plus/test';

import { ActionType } from '@/engine/modules/table-group/actions';
import {
  actions,
  tableGroupReducers,
} from '@/engine/modules/table-group/atom.actions';

describe('table-group/actions', () => {
  it('exposes the exact action type strings the persisted protocol relies on', () => {
    expect(ActionType).toEqual({
      addTableGroup: 'tableGroup.add',
      moveTableGroup: 'tableGroup.move',
      moveToTableGroup: 'tableGroup.moveTo',
      removeTableGroup: 'tableGroup.remove',
      resizeTableGroup: 'tableGroup.resize',
      changeTableGroupName: 'tableGroup.changeName',
      changeTableGroupColor: 'tableGroup.changeColor',
      changeTableGroupZIndex: 'tableGroup.changeZIndex',
    });
  });

  it('has a reducer registered for every action type', () => {
    expect(Object.keys(tableGroupReducers).sort()).toEqual(
      Object.values(ActionType).sort()
    );
  });

  it('has an action creator whose type matches each action type', () => {
    const creatorTypes = Object.values(actions).map(creator => creator.type);

    expect(creatorTypes.sort()).toEqual(Object.values(ActionType).sort());
  });
});
