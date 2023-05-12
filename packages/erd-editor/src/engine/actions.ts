import { ActionMap as EditorActionMap } from '@/engine/modules/editor/actions';
import { actions as editorActions } from '@/engine/modules/editor/atom.actions';
import { ActionMap as TableActionMap } from '@/engine/modules/table/actions';
import { actions as tableActions } from '@/engine/modules/table/atom.actions';
import { actions$ as tableActions$ } from '@/engine/modules/table/generator.actions';
import { ActionMap as TableColumnActionMap } from '@/engine/modules/tableColumn/actions';
import { actions as tableColumnActions } from '@/engine/modules/tableColumn/atom.actions';
import { actions$ as tableColumnActions$ } from '@/engine/modules/tableColumn/generator.actions';

export type Actions = typeof editorActions &
  typeof tableActions &
  typeof tableActions$ &
  typeof tableColumnActions &
  typeof tableColumnActions$;

export type RootActionMap = EditorActionMap &
  TableActionMap &
  TableColumnActionMap;

export const actions: Actions = Object.freeze({
  ...editorActions,
  ...tableActions,
  ...tableActions$,
  ...tableColumnActions,
  ...tableColumnActions$,
});

// TODO: changeActionTypes
export const ChangeActionTypes: ReadonlyArray<string> = [];

// TODO: historyActionTypes
export const HistoryActionTypes: ReadonlyArray<string> = [];

// TODO: streamActionTypes
export const StreamActionTypes: ReadonlyArray<string> = [];
