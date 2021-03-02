import { Store } from '@@types/engine/store';
import { MoveKey } from '@@types/engine/store/editor.state';
import { focusMoveTable } from './editor.cmd.helper';
import { addColumn$ } from './column.cmd.helper';
import {
  isTableFocusType,
  isLastTable,
  isColumns,
  isLastColumn,
  isLastRowColumn,
} from './helper/editor.focus.helper';

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
