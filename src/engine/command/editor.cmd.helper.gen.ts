import { Store } from '@@types/engine/store';
import { MoveKey } from '@@types/engine/store/editor.state';
import { RelationshipType } from '@@types/engine/store/relationship.state';
import {
  focusMoveTable,
  focusColumn,
  drawStartRelationship,
  drawStartAddRelationship,
  drawEndRelationship,
  clear,
  loadJson,
} from './editor.cmd.helper';
import { addColumn$, addCustomColumn } from './column.cmd.helper';
import {
  isTableFocusType,
  isLastTable,
  isColumns,
  isLastColumn,
  isLastRowColumn,
} from './helper/editor.focus.helper';
import { getData } from '@/core/helper';

export function* focusMoveTable$(
  store: Store,
  moveKey: MoveKey,
  shiftKey: boolean
) {
  const {
    editorState: { focusTable },
  } = store;
  if (!focusTable) return;

  if (
    moveKey === 'Tab' &&
    !shiftKey &&
    ((isTableFocusType(focusTable.focusType) &&
      isLastTable(store) &&
      !isColumns(focusTable)) ||
      (!isTableFocusType(focusTable.focusType) &&
        isLastColumn(store) &&
        isLastRowColumn(focusTable)))
  ) {
    yield addColumn$(store, focusTable.table.id);
  } else {
    yield focusMoveTable(moveKey, shiftKey);
  }
}

export function* drawStartRelationship$(
  { editorState }: Store,
  relationshipType: RelationshipType
) {
  if (editorState.drawRelationship?.relationshipType === relationshipType) {
    yield drawEndRelationship();
  } else {
    yield drawStartRelationship(relationshipType);
  }
}

export function* drawStartAddRelationship$(
  { tableState: { tables } }: Store,
  tableId: string
) {
  const table = getData(tables, tableId);
  if (!table) return;

  if (!table.columns.some(column => column.option.primaryKey)) {
    const addCustomColumnCmd = addCustomColumn(
      {
        autoIncrement: false,
        primaryKey: true,
        unique: false,
        notNull: true,
      },
      {
        active: false,
        pk: true,
        fk: false,
        pfk: false,
      },
      null,
      [tableId]
    );

    yield addCustomColumnCmd;
    const column = addCustomColumnCmd.data[0];
    yield focusColumn(tableId, column.id, 'columnName');
  }

  yield drawStartAddRelationship(tableId);
}

export function* loadJson$(value: string) {
  yield clear();
  yield loadJson(value);
}
