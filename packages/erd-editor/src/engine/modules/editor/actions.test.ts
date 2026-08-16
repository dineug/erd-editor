import { describe, expect, it } from 'vite-plus/test';

import { ActionType } from '@/engine/modules/editor/actions';
import { actions, editorReducers } from '@/engine/modules/editor/atom.actions';

describe('editor/actions', () => {
  it('namespaces every action type under "editor."', () => {
    const entries = Object.entries(ActionType);
    expect(entries.length).toBeGreaterThan(0);

    for (const [key, type] of entries) {
      expect(type).toBe(`editor.${key}`);
    }
  });

  it('has unique action types', () => {
    const values = Object.values(ActionType);
    expect(new Set(values).size).toBe(values.length);
  });

  it('exposes a reducer for every action type', () => {
    for (const type of Object.values(ActionType)) {
      expect(typeof Reflect.get(editorReducers, type)).toBe('function');
    }
    expect(Object.keys(editorReducers).sort()).toEqual(
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
    const action = actions.changeViewportAction({ width: 10, height: 20 });
    expect(action.type).toBe(ActionType.changeViewport);
    expect(action.payload).toEqual({ width: 10, height: 20 });
    expect(`${actions.changeViewportAction}`).toBe(ActionType.changeViewport);
  });

  it('keeps the well-known action type literals stable', () => {
    expect(ActionType.loadJson).toBe('editor.loadJson');
    expect(ActionType.clear).toBe('editor.clear');
    expect(ActionType.mergeLWW).toBe('editor.mergeLWW');
    expect(ActionType.getLWW).toBe('editor.getLWW');
  });
});
