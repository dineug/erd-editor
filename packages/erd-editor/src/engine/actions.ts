import {
  pushStreamHistoryMap,
  pushUndoHistoryMap,
} from '@/engine/history.actions';
import { ActionMap as EditorActionMap } from '@/engine/modules/editor/actions';
import { actions as editorActions } from '@/engine/modules/editor/atom.actions';
import { actions$ as editorActions$ } from '@/engine/modules/editor/generator.actions';
import { actions as indexActions } from '@/engine/modules/index/atom.actions';
import { actions$ as indexActions$ } from '@/engine/modules/index/generator.actions';
import { actions as indexColumnActions } from '@/engine/modules/indexColumn/atom.actions';
import { actions$ as indexColumnActions$ } from '@/engine/modules/indexColumn/generator.actions';
import { ActionMap as MemoActionMap } from '@/engine/modules/memo/actions';
import { actions as memoActions } from '@/engine/modules/memo/atom.actions';
import { actions$ as memoActions$ } from '@/engine/modules/memo/generator.actions';
import { ActionMap as RelationshipActionMap } from '@/engine/modules/relationship/actions';
import { actions as relationshipActions } from '@/engine/modules/relationship/atom.actions';
import { actions$ as relationshipActions$ } from '@/engine/modules/relationship/generator.actions';
import { ActionMap as SettingsActionMap } from '@/engine/modules/settings/actions';
import { actions as settingsActions } from '@/engine/modules/settings/atom.actions';
import { actions$ as settingsActions$ } from '@/engine/modules/settings/generator.actions';
import { ActionMap as TableActionMap } from '@/engine/modules/table/actions';
import { actions as tableActions } from '@/engine/modules/table/atom.actions';
import { actions$ as tableActions$ } from '@/engine/modules/table/generator.actions';
import { ActionMap as TableColumnActionMap } from '@/engine/modules/tableColumn/actions';
import { actions as tableColumnActions } from '@/engine/modules/tableColumn/atom.actions';
import { actions$ as tableColumnActions$ } from '@/engine/modules/tableColumn/generator.actions';

export type Actions = typeof editorActions &
  typeof editorActions$ &
  typeof indexActions &
  typeof indexActions$ &
  typeof indexColumnActions &
  typeof indexColumnActions$ &
  typeof memoActions &
  typeof memoActions$ &
  typeof relationshipActions &
  typeof relationshipActions$ &
  typeof settingsActions &
  typeof settingsActions$ &
  typeof tableActions &
  typeof tableActions$ &
  typeof tableColumnActions &
  typeof tableColumnActions$;

export type RootActionMap = EditorActionMap &
  TableActionMap &
  TableColumnActionMap &
  MemoActionMap &
  RelationshipActionMap &
  SettingsActionMap;

export type ActionType = keyof RootActionMap;

export const actions: Actions = Object.freeze({
  ...editorActions,
  ...editorActions$,
  ...indexActions,
  ...indexActions$,
  ...indexColumnActions,
  ...indexColumnActions$,
  ...memoActions,
  ...memoActions$,
  ...relationshipActions,
  ...relationshipActions$,
  ...settingsActions,
  ...settingsActions$,
  ...tableActions,
  ...tableActions$,
  ...tableColumnActions,
  ...tableColumnActions$,
});

// TODO: changeActionTypes
export const ChangeActionTypes: ReadonlyArray<ActionType> = [
  // table
  'table.add',
  'table.move',
  'table.moveTo',
  'table.remove',
  'table.changeName',
  'table.changeComment',
  'table.changeColor',
  // column
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
  // relationship
  'relationship.add',
  'relationship.remove',
  'relationship.changeType',
  // index
  // indexColumn
  // memo
  'memo.add',
  'memo.move',
  'memo.remove',
  'memo.changeValue',
  'memo.changeColor',
  'memo.resize',
  // settings
  'settings.changeDatabaseName',
  'settings.resize',
  'settings.changeZoomLevel',
  'settings.streamZoomLevel',
  'settings.scrollTo',
  'settings.streamScrollTo',
  'settings.changeShow',
  'settings.changeDatabase',
  'settings.changeCanvasType',
  'settings.changeLanguage',
  'settings.changeTableNameCase',
  'settings.changeColumnNameCase',
  'settings.changeBracketType',
  'settings.changeRelationshipDataTypeSync',
  'settings.changeRelationshipOptimization',
  'settings.changeColumnOrder',
  // editor
  'editor.loadJson',
  'editor.clear',
];

export const StreamActionTypes: ReadonlyArray<ActionType> = [
  ...(Object.keys(pushStreamHistoryMap) as ActionType[]),
];

export const HistoryActionTypes: ReadonlyArray<ActionType> = [
  ...(Object.keys(pushUndoHistoryMap) as ActionType[]),
  ...StreamActionTypes,
];
