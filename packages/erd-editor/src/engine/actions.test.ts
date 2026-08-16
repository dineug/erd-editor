import { describe, expect, it } from 'vite-plus/test';

import {
  actions,
  ChangeActionTypes,
  HistoryActionTypes,
  ReadonlyIgnoreActionTypes,
  SharedActionTypes,
  SharedFollowingActionTypes,
  SharedStreamActionTypes,
  StreamActionTypes,
  StreamRegroupColorActionTypes,
  StreamRegroupMoveActionTypes,
  StreamRegroupScrollActionTypes,
} from '@/engine/actions';
import { Clock } from '@/engine/clock';
import {
  pushStreamHistoryMap,
  pushUndoHistoryMap,
} from '@/engine/history.actions';
import { ActionType as EditorActionType } from '@/engine/modules/editor/actions';
import { ActionType as IndexActionType } from '@/engine/modules/index/actions';
import { ActionType as IndexColumnActionType } from '@/engine/modules/index-column/actions';
import { ActionType as MemoActionType } from '@/engine/modules/memo/actions';
import { ActionType as RelationshipActionType } from '@/engine/modules/relationship/actions';
import { ActionType as SettingsActionType } from '@/engine/modules/settings/actions';
import { ActionType as TableActionType } from '@/engine/modules/table/actions';
import { ActionType as TableColumnActionType } from '@/engine/modules/table-column/actions';
import { createStore } from '@/engine/store';

const allActionTypes = new Set<string>([
  ...Object.values(EditorActionType),
  ...Object.values(TableActionType),
  ...Object.values(TableColumnActionType),
  ...Object.values(MemoActionType),
  ...Object.values(RelationshipActionType),
  ...Object.values(SettingsActionType),
  ...Object.values(IndexActionType),
  ...Object.values(IndexColumnActionType),
]);

const atomActionTypes = new Set<string>(
  Object.values(actions)
    .map((creator: any) => creator?.type)
    .filter((type): type is string => typeof type === 'string')
);

const READONLY_IGNORED = [
  'settings.changeZoomLevel',
  'settings.streamZoomLevel',
  'settings.scrollTo',
  'settings.streamScrollTo',
  'settings.changeDatabase',
  'settings.changeCanvasType',
  'settings.changeLanguage',
  'settings.changeTableNameCase',
  'settings.changeColumnNameCase',
  'settings.changeBracketType',
];

describe('actions registry', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(actions)).toBe(true);
  });

  it('merges the atom and generator creators of every module', () => {
    // atom creators
    expect(typeof actions.addMemoAction).toBe('function');
    expect(typeof actions.addTableAction).toBe('function');
    expect(typeof actions.addColumnAction).toBe('function');
    expect(typeof actions.addRelationshipAction).toBe('function');
    expect(typeof actions.addIndexAction).toBe('function');
    expect(typeof actions.addIndexColumnAction).toBe('function');
    expect(typeof actions.changeDatabaseNameAction).toBe('function');
    expect(typeof actions.loadJsonAction).toBe('function');
    // generator creators
    expect(typeof actions.addMemoAction$).toBe('function');
    expect(typeof actions.addTableAction$).toBe('function');
    expect(typeof actions.loadJsonAction$).toBe('function');
    expect(typeof actions.changeZoomLevelAction$).toBe('function');
  });

  it('every atom creator produces an action its reducer understands', () => {
    const action = actions.addMemoAction({
      id: 'm1',
      ui: { x: 1, y: 2, zIndex: 3 },
    });

    expect(action).toEqual({ type: 'memo.add', payload: action.payload });
    expect(String(actions.addMemoAction)).toBe('memo.add');

    const store = createStore({
      toWidth: text => text.length * 10,
      clock: new Clock(),
    });
    store.dispatchSync(action);

    expect(store.state.doc.memoIds).toEqual(['m1']);
    store.destroy();
  });
});

describe('ChangeActionTypes', () => {
  it('has no duplicates', () => {
    expect(new Set(ChangeActionTypes).size).toBe(ChangeActionTypes.length);
  });

  it('only references action types declared by a module', () => {
    const unknown = ChangeActionTypes.filter(
      type => !allActionTypes.has(type as string)
    );

    expect(unknown).toEqual([]);
  });

  it('only references types backed by an atom action creator', () => {
    const missing = ChangeActionTypes.filter(
      type => !atomActionTypes.has(type as string)
    );

    expect(missing).toEqual([]);
  });

  it('covers every module namespace', () => {
    const namespaces = new Set(
      ChangeActionTypes.map(type => (type as string).split('.')[0])
    );

    expect([...namespaces].sort()).toEqual([
      'column',
      'editor',
      'index',
      'indexColumn',
      'memo',
      'relationship',
      'settings',
      'table',
    ]);
  });

  it('excludes purely local editor UI actions', () => {
    expect(ChangeActionTypes).not.toContain('editor.select');
    expect(ChangeActionTypes).not.toContain('editor.changeViewport');
    expect(ChangeActionTypes).not.toContain('editor.sharedMouseTracker');
    expect(ChangeActionTypes).not.toContain('memo.changeZIndex');
  });
});

describe('ReadonlyIgnoreActionTypes', () => {
  it('is ChangeActionTypes minus the view-only settings actions', () => {
    expect(ReadonlyIgnoreActionTypes).toEqual(
      ChangeActionTypes.filter(type => !READONLY_IGNORED.includes(type))
    );
    expect(ReadonlyIgnoreActionTypes.length).toBe(
      ChangeActionTypes.length - READONLY_IGNORED.length
    );
  });

  it('drops each view-only settings action', () => {
    for (const type of READONLY_IGNORED) {
      expect(ChangeActionTypes).toContain(type);
      expect(ReadonlyIgnoreActionTypes).not.toContain(type);
    }
  });

  it('keeps document-mutating actions', () => {
    expect(ReadonlyIgnoreActionTypes).toContain('table.add');
    expect(ReadonlyIgnoreActionTypes).toContain('column.remove');
    expect(ReadonlyIgnoreActionTypes).toContain('editor.loadJson');
  });
});

describe('shared action types', () => {
  it('SharedStreamActionTypes tracks only the mouse tracker', () => {
    expect(SharedStreamActionTypes).toEqual(['editor.sharedMouseTracker']);
  });

  it('SharedActionTypes is ChangeActionTypes plus stream and LWW sync', () => {
    expect(SharedActionTypes).toEqual([
      ...ChangeActionTypes,
      ...SharedStreamActionTypes,
      'editor.getLWW',
      'editor.mergeLWW',
    ]);
    expect(new Set(SharedActionTypes).size).toBe(SharedActionTypes.length);
  });

  it('SharedFollowingActionTypes is a subset of the readonly-ignored settings', () => {
    for (const type of SharedFollowingActionTypes) {
      expect(READONLY_IGNORED).toContain(type as string);
      expect(ChangeActionTypes).toContain(type);
    }
    expect(SharedFollowingActionTypes).toEqual([
      'settings.changeZoomLevel',
      'settings.streamZoomLevel',
      'settings.scrollTo',
      'settings.streamScrollTo',
      'settings.changeCanvasType',
    ]);
  });
});

describe('stream regroup action types', () => {
  it('groups move, color and scroll streams', () => {
    expect(StreamRegroupMoveActionTypes).toEqual(['table.move', 'memo.move']);
    expect(StreamRegroupColorActionTypes).toEqual([
      'table.changeColor',
      'memo.changeColor',
    ]);
    expect(StreamRegroupScrollActionTypes).toEqual([
      'settings.streamZoomLevel',
      'settings.streamScrollTo',
    ]);
  });

  it('regrouped types are all change actions', () => {
    for (const type of [
      ...StreamRegroupMoveActionTypes,
      ...StreamRegroupColorActionTypes,
      ...StreamRegroupScrollActionTypes,
    ]) {
      expect(ChangeActionTypes).toContain(type);
    }
  });
});

describe('history action types', () => {
  it('StreamActionTypes mirrors the stream history map keys', () => {
    expect(StreamActionTypes).toEqual(Object.keys(pushStreamHistoryMap));
    expect(StreamActionTypes.length).toBeGreaterThan(0);
  });

  it('HistoryActionTypes is the undo map keys followed by the stream keys', () => {
    expect(HistoryActionTypes).toEqual([
      ...Object.keys(pushUndoHistoryMap),
      ...StreamActionTypes,
    ]);
  });

  it('every history action type is a known module action type', () => {
    const unknown = HistoryActionTypes.filter(
      type => !allActionTypes.has(type as string)
    );

    expect(unknown).toEqual([]);
  });

  it('records undo entries for structural changes', () => {
    expect(HistoryActionTypes).toContain('table.add');
    expect(HistoryActionTypes).toContain('memo.remove');
    expect(HistoryActionTypes).toContain('relationship.add');
  });
});
