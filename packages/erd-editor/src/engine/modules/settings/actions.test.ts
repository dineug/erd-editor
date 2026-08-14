import { describe, expect, it } from 'vitest';

import { ActionType } from '@/engine/modules/settings/actions';
import {
  actions,
  settingsReducers,
} from '@/engine/modules/settings/atom.actions';

describe('settings/actions', () => {
  it('namespaces every action type under "settings."', () => {
    const entries = Object.entries(ActionType);
    expect(entries.length).toBeGreaterThan(0);

    for (const [key, type] of entries) {
      expect(type).toBe(`settings.${key}`);
    }
  });

  it('has unique action types', () => {
    const values = Object.values(ActionType);
    expect(new Set(values).size).toBe(values.length);
  });

  it('exposes a reducer for every action type', () => {
    for (const type of Object.values(ActionType)) {
      expect(typeof Reflect.get(settingsReducers, type)).toBe('function');
    }
    expect(Object.keys(settingsReducers).slice().sort()).toEqual(
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

  it('action creators build actions carrying the matching type', () => {
    const action = actions.resizeAction({ width: 3000, height: 4000 });
    expect(action.type).toBe(ActionType.resize);
    expect(action.payload).toEqual({ width: 3000, height: 4000 });
    expect(`${actions.resizeAction}`).toBe(ActionType.resize);
  });

  it('keeps the well-known action type literals stable', () => {
    expect(ActionType.changeDatabaseName).toBe('settings.changeDatabaseName');
    expect(ActionType.streamScrollTo).toBe('settings.streamScrollTo');
    expect(ActionType.streamZoomLevel).toBe('settings.streamZoomLevel');
    expect(ActionType.changeIgnoreSaveSettings).toBe(
      'settings.changeIgnoreSaveSettings'
    );
  });
});
