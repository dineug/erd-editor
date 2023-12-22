import { beforeMount } from '@vuerd/lit-observable';

import { relationshipMenus } from '@/core/contextmenu/drawRelationship.menu';
import { Bus } from '@/core/helper/eventBus.helper';
import { keymapMatchAndStop } from '@/core/keymap';
import { movementZoomCanvas } from '@/engine/command/canvas.cmd.helper';
import {
  addColumn$,
  changeColumnAutoIncrement,
  changeColumnNotNull,
  changeColumnPrimaryKey$,
  changeColumnUnique,
  removeColumn$,
} from '@/engine/command/column.cmd.helper';
import {
  copyColumn,
  drawEndRelationship,
  drawStartRelationship$,
  editTable,
  editTableEnd,
  findActive$,
  findActiveEnd,
  focusMoveTable,
  focusMoveTable$,
  pasteColumn$,
  selectAllColumn,
} from '@/engine/command/editor.cmd.helper';
import {
  addMemo$,
  removeMemo,
  selectAllMemo,
  selectEndMemo,
} from '@/engine/command/memo.cmd.helper';
import {
  addTable$,
  hideTable,
  removeTable,
  selectAllTable,
  selectEndTable$,
  selectTable$,
} from '@/engine/command/table.cmd.helper';
import { moveKeys } from '@/engine/store/editor.state';
import { BatchCommand } from '@@types/engine/command';
import { FocusType, MoveKey } from '@@types/engine/store/editor.state';

import { useContext } from './context.hook';
import { useUnmounted } from './unmounted.hook';

const changeColumnMap = {
  columnNotNull: changeColumnNotNull,
  columnUnique: changeColumnUnique,
  columnAutoIncrement: changeColumnAutoIncrement,
};

const changeColumnKeys: FocusType[] = [
  'columnNotNull',
  'columnUnique',
  'columnAutoIncrement',
];

export function useERDKeymap(ctx: HTMLElement) {
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();

  const onKeydown = (event: KeyboardEvent) => {
    const { keymap, store, eventBus } = contextRef.value;
    const { tableState, memoState, editorState } = store;

    if (!editorState.focusTable || !editorState.focusTable.edit) {
      keymapMatchAndStop(event, keymap.addTable) &&
        store.dispatch(addTable$(store));

      keymapMatchAndStop(event, keymap.addColumn) &&
        tableState.tables.some(table => table.ui.active) &&
        store.dispatch(addColumn$(store));

      keymapMatchAndStop(event, keymap.addMemo) &&
        store.dispatch(addMemo$(store));

      keymapMatchAndStop(event, keymap.selectAllTable) &&
        store.dispatch(selectAllTable(), selectAllMemo());

      relationshipMenus.forEach(
        relationshipMenu =>
          keymapMatchAndStop(
            event,
            (keymap as any)[relationshipMenu.keymapName]
          ) &&
          store.dispatch(
            drawStartRelationship$(store, relationshipMenu.relationshipType)
          )
      );

      if (
        keymapMatchAndStop(event, keymap.removeTable) &&
        (store.tableState.tables.some(table => table.ui.active) ||
          store.memoState.memos.some(memo => memo.ui.active))
      ) {
        const commands: BatchCommand = [];

        tableState.tables.some(table => table.ui.active) &&
          commands.push(removeTable(store));

        memoState.memos.some(memo => memo.ui.active) &&
          commands.push(removeMemo(store));

        store.dispatch(...commands);
      }

      if (
        keymapMatchAndStop(event, keymap.tableProperties) &&
        store.tableState.tables.some(table => table.ui.active)
      ) {
        const table = store.tableState.tables.find(table => table.ui.active);
        if (!table) return;

        eventBus.emit(Bus.Drawer.openTableProperties, {
          tableId: editorState.focusTable
            ? editorState.focusTable.table.id
            : table.id,
        });
      }

      if (keymapMatchAndStop(event, keymap.find)) {
        if (editorState.findActive) {
          store.dispatch(findActiveEnd());
        } else {
          store.dispatch(findActive$());
        }

        eventBus.emit(Bus.Drawer.close);
      }

      keymapMatchAndStop(event, keymap.zoomIn) &&
        store.dispatch(movementZoomCanvas(0.1));
      keymapMatchAndStop(event, keymap.zoomOut) &&
        store.dispatch(movementZoomCanvas(-0.1));
    }

    if (editorState.focusTable && !editorState.focusTable.edit) {
      keymapMatchAndStop(event, keymap.selectAllColumn) &&
        store.dispatch(selectAllColumn());

      editorState.focusTable.selectColumnIds.length &&
        keymapMatchAndStop(event, keymap.removeColumn) &&
        store.dispatch(
          removeColumn$(
            store,
            editorState.focusTable.table.id,
            editorState.focusTable.selectColumnIds
          )
        );

      editorState.focusTable.selectColumnIds.length &&
        keymapMatchAndStop(event, keymap.copyColumn) &&
        store.dispatch(
          copyColumn(
            editorState.focusTable.table.id,
            editorState.focusTable.selectColumnIds
          )
        );

      keymapMatchAndStop(event, keymap.pasteColumn) &&
        store.dispatch(pasteColumn$(store));

      editorState.focusTable.columnId &&
        keymapMatchAndStop(event, keymap.primaryKey) &&
        store.dispatch(
          changeColumnPrimaryKey$(
            store,
            editorState.focusTable.table.id,
            editorState.focusTable.columnId
          )
        );

      event.key !== 'Tab' &&
        moveKeys.includes(event.key as MoveKey) &&
        store.dispatch(focusMoveTable(event.key as MoveKey, event.shiftKey));
    }

    if (editorState.focusTable && event.key === 'Tab') {
      event.preventDefault();
      store.dispatch(
        focusMoveTable$(store, event.key as MoveKey, event.shiftKey)
      );

      setTimeout(() => {
        if (
          !editorState.focusTable ||
          changeColumnKeys.includes(editorState.focusTable.focusType)
        )
          return;

        store.dispatch(editTable());
      }, 0);
    }

    if (editorState.focusTable && keymapMatchAndStop(event, keymap.edit)) {
      const focusTable = editorState.focusTable;

      if (focusTable.edit) {
        store.dispatch(editTableEnd());
      } else if (
        focusTable.columnId &&
        changeColumnKeys.includes(focusTable.focusType)
      ) {
        const changeColumn = (changeColumnMap as any)[focusTable.focusType];

        store.dispatch(
          changeColumn(store, focusTable.table.id, focusTable.columnId)
        );
      } else {
        store.dispatch(editTable());
      }
    }

    if (keymapMatchAndStop(event, keymap.stop)) {
      const commands: BatchCommand = [drawEndRelationship(), findActiveEnd()];

      if (editorState.findActive) {
        const table = store.tableState.tables.find(table => table.ui.active);

        if (table) {
          commands.push(selectTable$(store, false, table.id));
        }
      } else {
        commands.push(selectEndMemo(), selectEndTable$());
      }

      store.dispatch(...commands);
    }

    keymapMatchAndStop(event, keymap.undo) && store.undo();
    keymapMatchAndStop(event, keymap.redo) && store.redo();
  };

  beforeMount(() => {
    const { helper } = contextRef.value;
    unmountedGroup.push(helper.keydown$.subscribe(onKeydown));
  });
}
