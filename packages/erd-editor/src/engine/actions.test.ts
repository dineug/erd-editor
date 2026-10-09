import { describe, expect, it } from 'vite-plus/test';

import { LockSettingType, LockSettingTypeList } from '@/constants/schema';
import {
  actions,
  type ActionType,
  ChangeActionTypes,
  HistoryActionTypes,
  LockSettingActionTypes,
  ReadonlyIgnoreActionTypes,
  ReplicaActionTypes,
  ReplicaChangeActionTypes,
  SharedActionTypes,
  SharedFollowingActionTypes,
  SharedStreamActionTypes,
  StreamActionTypes,
  StreamRegroupColorActionTypes,
  StreamRegroupMoveActionTypes,
  StreamRegroupScrollActionTypes,
  ViewIgnoreActionTypes,
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
import { ActionType as TableGroupActionType } from '@/engine/modules/table-group/actions';
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
  ...Object.values(TableGroupActionType),
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
      'tableGroup',
    ]);
  });

  it('counts sixty-eight change types, the Schema SQL scripts among them', () => {
    expect(ChangeActionTypes).toHaveLength(68);
    expect(ChangeActionTypes).toContain('settings.changeDDLScript');
  });

  it('carries a script edit to the replica, the peers and the history, and lets no readonly host or view make one', () => {
    expect(ReplicaChangeActionTypes).toContain('settings.changeDDLScript');
    expect(ReplicaActionTypes).toContain('settings.changeDDLScript');
    expect(SharedActionTypes).toContain('settings.changeDDLScript');
    expect(HistoryActionTypes).toContain('settings.changeDDLScript');
    expect(ReadonlyIgnoreActionTypes).toContain('settings.changeDDLScript');
    expect(ViewIgnoreActionTypes).toContain('settings.changeDDLScript');
    expect(LockSettingActionTypes).not.toHaveProperty(
      'settings.changeDDLScript'
    );
    expect(SharedFollowingActionTypes).not.toContain(
      'settings.changeDDLScript'
    );
  });

  it('excludes purely local editor UI actions', () => {
    expect(ChangeActionTypes).not.toContain('editor.select');
    expect(ChangeActionTypes).not.toContain('editor.changeViewport');
    expect(ChangeActionTypes).not.toContain('editor.sharedMouseTracker');
    expect(ChangeActionTypes).not.toContain('memo.changeZIndex');
    expect(ChangeActionTypes).not.toContain('tableGroup.changeZIndex');
  });
});

describe('the table group changes', () => {
  const GROUP_CHANGES = [
    'tableGroup.add',
    'tableGroup.move',
    'tableGroup.moveTo',
    'tableGroup.remove',
    'tableGroup.resize',
    'tableGroup.changeName',
    'tableGroup.changeColor',
    'table.changeGroup',
  ];

  it('reach the file, the peers and the replica, and no readonly host or view makes one', () => {
    for (const type of GROUP_CHANGES) {
      expect(ChangeActionTypes).toContain(type);
      expect(ReplicaActionTypes).toContain(type);
      expect(SharedActionTypes).toContain(type);
      expect(ReadonlyIgnoreActionTypes).toContain(type);
      expect(ViewIgnoreActionTypes).toContain(type);
      expect(HistoryActionTypes).toContain(type);
      expect(LockSettingActionTypes).not.toHaveProperty(type);
    }
  });

  it('stream a drag, a color and a resize, the drag and the color with the tables and memos', () => {
    expect(StreamActionTypes).toEqual(
      expect.arrayContaining([
        'tableGroup.move',
        'tableGroup.changeColor',
        'tableGroup.resize',
      ])
    );
    expect(StreamRegroupMoveActionTypes).toContain('tableGroup.move');
    expect(StreamRegroupColorActionTypes).toContain('tableGroup.changeColor');
  });

  it('leave raising a group to the reader, in no list', () => {
    expect(allActionTypes.has('tableGroup.changeZIndex')).toBe(true);
    expect(HistoryActionTypes).not.toContain('tableGroup.changeZIndex');
    expect(SharedActionTypes).not.toContain('tableGroup.changeZIndex');
  });
});

describe('ReplicaChangeActionTypes', () => {
  it('is ChangeActionTypes plus the save switch the locks replaced, a change of no other list', () => {
    expect(ReplicaChangeActionTypes).toEqual([
      ...ChangeActionTypes,
      'settings.changeIgnoreSaveSettings',
    ]);
    expect(SharedActionTypes).not.toContain(
      'settings.changeIgnoreSaveSettings'
    );
    expect(HistoryActionTypes).not.toContain(
      'settings.changeIgnoreSaveSettings'
    );
  });
});

describe('ReplicaActionTypes', () => {
  it('is what a replica reports plus the registers a window answers a join with, never reported', () => {
    expect(ReplicaActionTypes).toEqual([
      ...ReplicaChangeActionTypes,
      'editor.mergeLWW',
    ]);
    expect(ReplicaChangeActionTypes).not.toContain('editor.mergeLWW');
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

describe('LockSettingActionTypes', () => {
  it('names the change of each lockable setting, under the lock that holds it', () => {
    expect(LockSettingActionTypes).toEqual({
      'settings.changeZoomLevel': LockSettingType.viewport,
      'settings.streamZoomLevel': LockSettingType.viewport,
      'settings.scrollTo': LockSettingType.viewport,
      'settings.streamScrollTo': LockSettingType.viewport,
      'settings.changeCanvasType': LockSettingType.canvasType,
      'settings.changeLanguage': LockSettingType.language,
      'settings.changeTableNameCase': LockSettingType.tableNameCase,
      'settings.changeColumnNameCase': LockSettingType.columnNameCase,
      'settings.changeBracketType': LockSettingType.bracketType,
    });
  });

  it('holds out only change actions, every lock among them', () => {
    const types = Object.keys(LockSettingActionTypes) as ActionType[];

    for (const type of types) expect(ChangeActionTypes).toContain(type);
    expect(new Set(Object.values(LockSettingActionTypes))).toEqual(
      new Set(LockSettingTypeList)
    );
  });

  it('leaves the lock itself a change, which the file holds', () => {
    expect(ChangeActionTypes).toContain('settings.changeLockSettings');
    expect(LockSettingActionTypes).not.toHaveProperty(
      'settings.changeLockSettings'
    );
  });
});

describe('ViewIgnoreActionTypes', () => {
  it('is ReadonlyIgnoreActionTypes minus the two document replacements', () => {
    expect(ViewIgnoreActionTypes).toEqual(
      ReadonlyIgnoreActionTypes.filter(
        type => type !== 'editor.loadJson' && type !== 'editor.clear'
      )
    );
    expect(ViewIgnoreActionTypes.length).toBe(
      ReadonlyIgnoreActionTypes.length - 2
    );
  });

  it('only references types backed by an atom action creator', () => {
    const missing = ViewIgnoreActionTypes.filter(
      type => !atomActionTypes.has(type as string)
    );

    expect(missing).toEqual([]);
  });
});

describe('view action types', () => {
  const VIEW_ACTION_TYPES = [
    'editor.viewOpen',
    'editor.viewClose',
    'editor.viewScrollTo',
    'editor.viewStreamScrollTo',
    'editor.viewChangeZoomLevel',
    'editor.viewStreamZoomLevel',
    'editor.viewMoveTable',
    'editor.viewSetLayout',
    'editor.viewChangeShowMode',
    'editor.viewSetCenters',
    'editor.changeVisualizationMode',
  ];

  it('are declared by the editor module with an atom creator each', () => {
    for (const type of VIEW_ACTION_TYPES) {
      expect(allActionTypes.has(type)).toBe(true);
      expect(atomActionTypes.has(type)).toBe(true);
    }
  });

  it('stay out of every list that reaches the file, the history or a peer', () => {
    for (const type of VIEW_ACTION_TYPES) {
      expect(ChangeActionTypes).not.toContain(type);
      expect(HistoryActionTypes).not.toContain(type);
      expect(SharedActionTypes).not.toContain(type);
      expect(ReadonlyIgnoreActionTypes).not.toContain(type);
      expect(ViewIgnoreActionTypes).not.toContain(type);
    }
  });
});

describe('the mapping edit', () => {
  const MAPPING_EDIT = 'relationship.changeColumns';

  it('is a change every list derived from the change types carries', () => {
    expect(ChangeActionTypes).toContain(MAPPING_EDIT);
    expect(ReadonlyIgnoreActionTypes).toContain(MAPPING_EDIT);
    expect(ViewIgnoreActionTypes).toContain(MAPPING_EDIT);
    expect(SharedActionTypes).toContain(MAPPING_EDIT);
    expect(HistoryActionTypes).toContain(MAPPING_EDIT);
    expect(LockSettingActionTypes).not.toHaveProperty(MAPPING_EDIT);
  });

  it('stands with the other relationship changes', () => {
    expect(
      ChangeActionTypes.filter(type => type.startsWith('relationship.'))
    ).toEqual([
      'relationship.add',
      'relationship.remove',
      'relationship.changeType',
      'relationship.changeOnDelete',
      'relationship.changeOnUpdate',
      MAPPING_EDIT,
    ]);
  });

  it('leaves the draw and the open dialogs to the reader, in no list', () => {
    for (const type of [
      'editor.drawStartRelationship',
      'editor.drawStartAddRelationship',
      'editor.drawEndRelationship',
      'editor.drawRelationship',
      'editor.changeOpenMap',
    ]) {
      expect(allActionTypes.has(type)).toBe(true);
      expect(ChangeActionTypes).not.toContain(type);
      expect(HistoryActionTypes).not.toContain(type);
      expect(SharedActionTypes).not.toContain(type);
      expect(ReadonlyIgnoreActionTypes).not.toContain(type);
    }
  });
});

describe('shared action types', () => {
  it('SharedStreamActionTypes tracks the ephemeral presence streams', () => {
    expect(SharedStreamActionTypes).toEqual([
      'editor.sharedMouseTracker',
      'editor.sharedFocusTracker',
      'editor.sharedSelectionTracker',
      'editor.sharedDragSelectTracker',
    ]);
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
    expect(StreamRegroupMoveActionTypes).toEqual([
      'table.move',
      'memo.move',
      'tableGroup.move',
    ]);
    expect(StreamRegroupColorActionTypes).toEqual([
      'table.changeColor',
      'memo.changeColor',
      'tableGroup.changeColor',
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
