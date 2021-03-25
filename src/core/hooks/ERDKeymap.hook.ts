import { CommandTypeAll } from '@@types/engine/command';
import { MoveKey, FocusType } from '@@types/engine/store/editor.state';
import { beforeMount } from '@dineug/lit-observable';
import { useContext } from './context.hook';
import { useUnmounted } from './unmounted.hook';
import { keymapMatchAndStop } from '@/core/keymap';
import { relationshipMenus } from '@/core/contextmenu/drawRelationship.menu';
import { moveKeys } from '@/engine/store/editor.state';
import {
  changeColumnNotNull,
  changeColumnUnique,
  changeColumnAutoIncrement,
  addColumn$,
  removeColumn$,
  changeColumnPrimaryKey$,
} from '@/engine/command/column.cmd.helper';
import {
  removeTable,
  selectAllTable,
  addTable$,
  selectEndTable$,
} from '@/engine/command/table.cmd.helper';
import {
  removeMemo,
  selectAllMemo,
  selectEndMemo,
  addMemo$,
} from '@/engine/command/memo.cmd.helper';
import {
  focusMoveTable,
  editTable,
  editTableEnd,
  selectAllColumn,
  focusMoveTable$,
  drawStartRelationship$,
  drawEndRelationship,
} from '@/engine/command/editor.cmd.helper';
import { Drawer } from '@/core/helper/event.helper';

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
          keymapMatchAndStop(event, keymap[relationshipMenu.keymapName]) &&
          store.dispatch(
            drawStartRelationship$(store, relationshipMenu.relationshipType)
          )
      );

      if (
        keymapMatchAndStop(event, keymap.removeTable) &&
        (store.tableState.tables.some(table => table.ui.active) ||
          store.memoState.memos.some(memo => memo.ui.active))
      ) {
        const commands: CommandTypeAll[] = [];

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

        eventBus.emit(Drawer.openTableProperties, {
          tableId: editorState.focusTable
            ? editorState.focusTable.table.id
            : table.id,
        });
      }
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

    keymapMatchAndStop(event, keymap.stop) &&
      store.dispatch(selectEndMemo(), drawEndRelationship(), selectEndTable$());

    keymapMatchAndStop(event, keymap.undo) && store.undo();
    keymapMatchAndStop(event, keymap.redo) && store.redo();
  };

  beforeMount(() => {
    const { helper } = contextRef.value;
    unmountedGroup.push(helper.keydown$.subscribe(onKeydown));
  });
}
