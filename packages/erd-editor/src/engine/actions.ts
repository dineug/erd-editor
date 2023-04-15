import { ActionMap as EditorActionMap } from '@/engine/modules/editor/actions';
import { ActionMap as TableActionMap } from '@/engine/modules/table/actions';
import { ActionMap as TableColumnActionMap } from '@/engine/modules/tableColumn/actions';

export type RootActionMap = EditorActionMap &
  TableActionMap &
  TableColumnActionMap;

// TODO: changeActionTypes
export const ChangeActionTypes: ReadonlyArray<string> = [];

// TODO: historyActionTypes
export const HistoryActionTypes: ReadonlyArray<string> = [];

// TODO: streamActionTypes
export const StreamActionTypes: ReadonlyArray<string> = [];
