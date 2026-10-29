import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import { Open } from '@/constants/open';
import { LockSettingType, LockSettingTypeList } from '@/constants/schema';
import {
  actions,
  type ActionType,
  ChangeActionTypes,
  ClockActionTypes,
  EDIT_OPEN_KEYS,
  EditStateOpenActionTypes,
  HistoryActionTypes,
  LockSettingActionTypes,
  movesClock,
  ReadonlyIgnoreActionTypes,
  ReplicaActionTypes,
  ReplicaChangeActionTypes,
  ScreenSettingActionTypes,
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
import { ActionType as DictionaryActionType } from '@/engine/modules/dictionary/actions';
import { dictionaryReducers } from '@/engine/modules/dictionary/atom.actions';
import { ActionType as EditorActionType } from '@/engine/modules/editor/actions';
import { editorReducers } from '@/engine/modules/editor/atom.actions';
import { ActionType as IndexActionType } from '@/engine/modules/index/actions';
import { indexReducers } from '@/engine/modules/index/atom.actions';
import { ActionType as IndexColumnActionType } from '@/engine/modules/index-column/actions';
import { indexColumnReducers } from '@/engine/modules/index-column/atom.actions';
import { ActionType as MemoActionType } from '@/engine/modules/memo/actions';
import { memoReducers } from '@/engine/modules/memo/atom.actions';
import { ActionType as RelationshipActionType } from '@/engine/modules/relationship/actions';
import { relationshipReducers } from '@/engine/modules/relationship/atom.actions';
import { ActionType as SettingsActionType } from '@/engine/modules/settings/actions';
import { settingsReducers } from '@/engine/modules/settings/atom.actions';
import { ActionType as TableActionType } from '@/engine/modules/table/actions';
import { tableReducers } from '@/engine/modules/table/atom.actions';
import { ActionType as TableColumnActionType } from '@/engine/modules/table-column/actions';
import { tableColumnReducers } from '@/engine/modules/table-column/atom.actions';
import { ActionType as TableGroupActionType } from '@/engine/modules/table-group/actions';
import { tableGroupReducers } from '@/engine/modules/table-group/atom.actions';
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
  ...Object.values(DictionaryActionType),
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
  'settings.changeNameViewMode',
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
      'dictionary',
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

  it('counts seventy-six change types, the Schema SQL scripts and the name view among them', () => {
    expect(ChangeActionTypes).toHaveLength(76);
    expect(ChangeActionTypes).toContain('settings.changeDDLScript');
    expect(ChangeActionTypes).toContain('settings.changeNameViewMode');
  });

  it('carries a name view switch to the replica and the peers, follows it, takes it from a readonly reader and undoes none', () => {
    const type = 'settings.changeNameViewMode';

    expect(ReplicaActionTypes).toContain(type);
    expect(SharedActionTypes).toContain(type);
    expect(SharedFollowingActionTypes).toContain(type);
    expect(ReadonlyIgnoreActionTypes).not.toContain(type);
    expect(ViewIgnoreActionTypes).not.toContain(type);
    expect(HistoryActionTypes).not.toContain(type);
    expect(LockSettingActionTypes[type]).toBe(
      LockSettingType.unlockNameViewMode
    );
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

  it('stream a drag and a color with the tables and memos, and leave a resize one undo entry each', () => {
    expect(StreamActionTypes).toEqual(
      expect.arrayContaining(['tableGroup.move', 'tableGroup.changeColor'])
    );
    expect(StreamActionTypes).not.toContain('tableGroup.resize');
    expect(StreamRegroupMoveActionTypes).toContain('tableGroup.move');
    expect(StreamRegroupColorActionTypes).toContain('tableGroup.changeColor');
  });

  it('leave raising a group to the reader, in no list', () => {
    expect(allActionTypes.has('tableGroup.changeZIndex')).toBe(true);
    expect(HistoryActionTypes).not.toContain('tableGroup.changeZIndex');
    expect(SharedActionTypes).not.toContain('tableGroup.changeZIndex');
  });
});

describe('the dictionary and logical name changes', () => {
  const DICTIONARY_CHANGES = [
    'dictionary.add',
    'dictionary.update',
    'dictionary.remove',
    'table.changeLogicalName',
    'table.changeNameDerived',
    'column.changeLogicalName',
    'column.changeDomain',
    'column.changeNameDerived',
  ];

  it('reach the file, the peers, the replica and the history, and no readonly host or view makes one', () => {
    for (const type of DICTIONARY_CHANGES) {
      expect(ChangeActionTypes).toContain(type);
      expect(ReplicaChangeActionTypes).toContain(type);
      expect(ReplicaActionTypes).toContain(type);
      expect(SharedActionTypes).toContain(type);
      expect(ReadonlyIgnoreActionTypes).toContain(type);
      expect(ViewIgnoreActionTypes).toContain(type);
      expect(HistoryActionTypes).toContain(type);
      expect(atomActionTypes.has(type)).toBe(true);
    }
  });

  it('are no stream, no lock and no following', () => {
    for (const type of DICTIONARY_CHANGES) {
      expect(StreamActionTypes).not.toContain(type);
      expect(LockSettingActionTypes).not.toHaveProperty(type);
      expect(SharedFollowingActionTypes).not.toContain(type);
    }
  });

  it('are every type the dictionary module declares', () => {
    expect(
      DICTIONARY_CHANGES.filter(type => type.startsWith('dictionary.'))
    ).toEqual(Object.values(DictionaryActionType));
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

  it('counts sixty-five, every view edit and the two document replacements', () => {
    expect(ReadonlyIgnoreActionTypes).toHaveLength(65);
    expect(ReadonlyIgnoreActionTypes).toEqual([
      ...ViewIgnoreActionTypes,
      'editor.loadJson',
      'editor.clear',
    ]);
  });
});

describe('EditStateOpenActionTypes', () => {
  const CLOSING_TYPES = [
    'editor.editTableEnd',
    'editor.editMemoEnd',
    'editor.editTableGroupEnd',
    'editor.drawEndRelationship',
  ];

  it('names the cell, memo text and group name editors and the two steps that start a draw', () => {
    expect(EditStateOpenActionTypes).toEqual([
      'editor.editTable',
      'editor.editMemo',
      'editor.editTableGroup',
      'editor.drawStartRelationship',
      'editor.drawStartAddRelationship',
    ]);
  });

  it('extends the readonly list to seventy for the editor, and leaves it sixty-five', () => {
    const extended = new Set([
      ...ReadonlyIgnoreActionTypes,
      ...EditStateOpenActionTypes,
    ]);

    expect(extended.size).toBe(70);
    for (const type of EditStateOpenActionTypes) {
      expect(ReadonlyIgnoreActionTypes).not.toContain(type);
    }
  });

  it('are declared by the editor module, with a creator each, in no list that reaches the file, the history, a peer or a view', () => {
    for (const type of EditStateOpenActionTypes) {
      expect(allActionTypes.has(type)).toBe(true);
      expect(atomActionTypes.has(type)).toBe(true);
      expect(ChangeActionTypes).not.toContain(type);
      expect(HistoryActionTypes).not.toContain(type);
      expect(SharedActionTypes).not.toContain(type);
      expect(ViewIgnoreActionTypes).not.toContain(type);
    }
  });

  it('leave out what closes an edit, and the raises of a table, a memo or a group', () => {
    for (const type of [
      ...CLOSING_TYPES,
      'editor.changeOpenMap',
      'table.changeZIndex',
      'memo.changeZIndex',
      'tableGroup.changeZIndex',
    ]) {
      expect(allActionTypes.has(type)).toBe(true);
      expect(EditStateOpenActionTypes).not.toContain(type);
    }
  });

  it('pairs with the three dialogs of the open map that write the document', () => {
    expect(EDIT_OPEN_KEYS).toEqual([
      Open.mapColumns,
      Open.automaticTablePlacement,
      Open.timeTravel,
    ]);
    for (const key of [
      Open.tableProperties,
      Open.diffViewer,
      Open.exportImage,
      Open.search,
      Open.themeBuilder,
      Open.localePicker,
    ]) {
      expect(EDIT_OPEN_KEYS).not.toContain(key);
    }
  });
});

describe('ScreenSettingActionTypes', () => {
  it('names the eleven settings readonly lets through and the show bits', () => {
    expect([...ScreenSettingActionTypes].sort()).toEqual(
      [...READONLY_IGNORED, 'settings.changeShow'].sort()
    );
  });

  it('holds change types alone, which a writable store sends, saves and undoes', () => {
    ScreenSettingActionTypes.forEach(type => {
      expect(ChangeActionTypes).toContain(type);
      expect(atomActionTypes.has(type)).toBe(true);
    });
  });
});

describe('the end of a screen baseline', () => {
  it('is declared by the editor module with a creator, in no list that reaches the file, the history, a peer or a view', () => {
    const type = 'editor.endScreenSettings';

    expect(allActionTypes.has(type)).toBe(true);
    expect(atomActionTypes.has(type)).toBe(true);
    [
      ChangeActionTypes,
      ReplicaActionTypes,
      HistoryActionTypes,
      SharedActionTypes,
      ReadonlyIgnoreActionTypes,
      EditStateOpenActionTypes,
      ViewIgnoreActionTypes,
      ScreenSettingActionTypes,
    ].forEach(list => expect(list).not.toContain(type));
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
      'settings.changeNameViewMode': LockSettingType.unlockNameViewMode,
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
  const VIEW_IGNORED = [
    'table.add',
    'table.move',
    'table.moveTo',
    'table.remove',
    'table.changeName',
    'table.changeComment',
    'table.changeColor',
    'table.changeGroup',
    'table.sort',
    'table.changeLogicalName',
    'table.changeNameDerived',
    'column.add',
    'column.remove',
    'column.changeName',
    'column.changeComment',
    'column.changeDataType',
    'column.changeDefault',
    'column.changeAutoIncrement',
    'column.changePrimaryKey',
    'column.changeUnique',
    'column.changeNotNull',
    'column.move',
    'column.changeLogicalName',
    'column.changeDomain',
    'column.changeNameDerived',
    'relationship.add',
    'relationship.remove',
    'relationship.changeType',
    'relationship.changeOnDelete',
    'relationship.changeOnUpdate',
    'relationship.changeColumns',
    'index.add',
    'index.remove',
    'index.changeName',
    'index.changeUnique',
    'indexColumn.add',
    'indexColumn.remove',
    'indexColumn.move',
    'indexColumn.changeOrderType',
    'memo.add',
    'memo.move',
    'memo.moveTo',
    'memo.remove',
    'memo.changeValue',
    'memo.changeColor',
    'memo.resize',
    'tableGroup.add',
    'tableGroup.move',
    'tableGroup.moveTo',
    'tableGroup.remove',
    'tableGroup.resize',
    'tableGroup.changeName',
    'tableGroup.changeColor',
    'dictionary.add',
    'dictionary.update',
    'dictionary.remove',
    'settings.changeDatabaseName',
    'settings.changeShow',
    'settings.changeRelationshipDataTypeSync',
    'settings.changeColumnOrder',
    'settings.changeMaxWidthComment',
    'settings.changeLockSettings',
    'settings.changeDDLScript',
  ];

  it('names sixty-three edits of the document, in the order of the change types', () => {
    expect(ViewIgnoreActionTypes).toEqual(VIEW_IGNORED);
    expect(ViewIgnoreActionTypes).toHaveLength(63);
  });

  it('holds every change but the readonly passes and the two document replacements', () => {
    expect(ViewIgnoreActionTypes).toEqual(
      ChangeActionTypes.filter(
        type =>
          !READONLY_IGNORED.includes(type) &&
          type !== 'editor.loadJson' &&
          type !== 'editor.clear'
      )
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
    'editor.viewStepCenters',
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
      'settings.changeNameViewMode',
    ]);
  });
});

/** Every reducer the store runs, by the type it takes. */
const reducers = Object.entries({
  ...editorReducers,
  ...tableReducers,
  ...tableColumnReducers,
  ...memoReducers,
  ...relationshipReducers,
  ...settingsReducers,
  ...indexReducers,
  ...indexColumnReducers,
  ...tableGroupReducers,
  ...dictionaryReducers,
}) as Array<[string, (...args: never[]) => void]>;

const MODULES_ROOT = join(process.cwd(), 'src/engine/modules');

function moduleSources(directory = MODULES_ROOT, found: string[] = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      moduleSources(path, found);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      found.push(readFileSync(path, 'utf8'));
    }
  }
  return found;
}

/** Each top-level declaration of the modules by name: its text up to the next one. */
function moduleDeclarations(): Map<string, string> {
  const found = new Map<string, string>();
  for (const source of moduleSources()) {
    const starts = [
      ...source.matchAll(/^(?:export )?(?:const|function) (\w+)/gm),
    ];
    starts.forEach((start, index) => {
      const end = starts[index + 1]?.index ?? source.length;
      const text = source.slice(start.index, end);
      found.set(start[1], (found.get(start[1]) ?? '') + text);
    });
  }
  return found;
}

/**
 * The declarations that write a register: each one calling an LWW operator,
 * then each one calling such a declaration, until no more join, so a reducer
 * that writes through a helper of another module counts.
 */
function registerWriters(declarations: Map<string, string>): Set<string> {
  const writers = new Set<string>();
  const writes = (text: string) =>
    /\b(?:add|remove|replace)Operator\(/.test(text) ||
    [...writers].some(writer => new RegExp(`\\b${writer}\\(`).test(text));

  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, text] of declarations) {
      if (!writers.has(name) && writes(text)) {
        writers.add(name);
        grew = true;
      }
    }
  }
  return writers;
}

describe('ClockActionTypes', () => {
  it('is every change and the register handshake', () => {
    expect(ClockActionTypes).toEqual([
      ...ChangeActionTypes,
      'editor.getLWW',
      'editor.mergeLWW',
    ]);
  });

  it('holds every type whose reducer writes a register, read off the modules', () => {
    const declarations = moduleDeclarations();
    const writers = registerWriters(declarations);
    // A reducer the scan cannot name would pass unread, so each must be one.
    const unread = reducers
      .map(([, reducer]) => reducer.name)
      .filter(name => name !== 'noop' && !declarations.has(name));
    const writing = reducers
      .filter(([, reducer]) => writers.has(reducer.name))
      .map(([type]) => type);

    expect(unread).toEqual([]);
    expect(writing).toContain('editor.mergeLWW');
    expect(writing).toContain('editor.loadJson');
    expect(writing).toContain('settings.changeLanguage');
    expect(writing).not.toContain('editor.initialLoadJson');
    expect(
      writing.filter(type => !ClockActionTypes.includes(type as ActionType))
    ).toEqual([]);
  });

  it('decides each shared type outside the changes: the handshake moves the clock, presence does not', () => {
    const outsideChanges = SharedActionTypes.filter(
      type => !ChangeActionTypes.includes(type)
    );

    expect(
      outsideChanges.filter(type => ClockActionTypes.includes(type))
    ).toEqual(['editor.getLWW', 'editor.mergeLWW']);
    expect(
      outsideChanges.filter(type => !ClockActionTypes.includes(type))
    ).toEqual(SharedStreamActionTypes);
  });
});

describe('movesClock', () => {
  it('is true for each clock type and false for every other type a reducer takes', () => {
    for (const [type] of reducers) {
      expect(movesClock(type)).toBe(
        ClockActionTypes.includes(type as ActionType)
      );
    }
    for (const type of allActionTypes) {
      expect(movesClock(type)).toBe(
        ClockActionTypes.includes(type as ActionType)
      );
    }
    expect(movesClock('editor.sharedMouseTracker')).toBe(false);
    expect(movesClock('memo.changeZIndex')).toBe(false);
    expect(movesClock('settings.changeIgnoreSaveSettings')).toBe(false);
  });

  it('is true for a type no module declares, as a newer editor’s change may be', () => {
    expect(movesClock('table.changeShape')).toBe(true);
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
