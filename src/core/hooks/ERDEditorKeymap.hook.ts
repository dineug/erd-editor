import { CommandTypeAll } from '@@types/engine/command';
import { MoveKey, FocusType } from '@@types/engine/store/editor.state';
import { beforeMount, unmounted } from '@dineug/lit-observable';
import { useContext } from './context.hook';
import { createSubscriptionHelper } from '@/core/helper';
import { keymapMatchAndOption } from '@/core/keymap';
import { relationshipMenus } from '@/core/contextmenu/drawRelationship.contextmenu';
import { moveKeys } from '@/engine/store/editor.state';
import {
  addColumn$,
  changeColumnNotNull,
  changeColumnUnique,
  changeColumnAutoIncrement,
} from '@/engine/command/column.cmd.helper';
import {
  addTable$,
  removeTable,
  selectAllTable,
} from '@/engine/command/table.cmd.helper';
import {
  addMemo$,
  removeMemo,
  selectAllMemo,
} from '@/engine/command/memo.cmd.helper';
import {
  focusMoveTable,
  focusMoveTable$,
  editTable,
  editTableEnd,
} from '@/engine/command/editor.cmd.helper';

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

export function useERDEditorKeymap(ctx: HTMLElement) {
  const contextRef = useContext(ctx);
  const subscriptionHelper = createSubscriptionHelper();

  const onKeydown = (event: KeyboardEvent) => {
    const { keymap, store } = contextRef.value;
    const { tableState, memoState, editorState } = store;

    keymapMatchAndOption(event, keymap.addTable) &&
      store.dispatch(addTable$(store));

    keymapMatchAndOption(event, keymap.addColumn) &&
      tableState.tables.some(table => table.ui.active) &&
      store.dispatch(addColumn$(store));

    keymapMatchAndOption(event, keymap.addMemo) &&
      store.dispatch(addMemo$(store));

    keymapMatchAndOption(event, keymap.selectAllTable) &&
      store.dispatch(selectAllTable(), selectAllMemo());

    if (
      keymapMatchAndOption(event, keymap.removeTable) &&
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
      editorState.focusTable &&
      !editorState.focusTable.edit &&
      event.key !== 'Tab' &&
      moveKeys.includes(event.key as MoveKey)
    ) {
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
      }, 20);
    }

    if (editorState.focusTable && keymapMatchAndOption(event, keymap.edit)) {
      const focusTable = editorState.focusTable;

      if (focusTable.edit) {
        store.dispatch(editTableEnd());
      } else if (focusTable.columnId) {
        if (changeColumnKeys.includes(focusTable.focusType)) {
          const changeColumn = (changeColumnMap as any)[focusTable.focusType];

          store.dispatch(
            changeColumn(store, focusTable.table.id, focusTable.columnId)
          );
        } else {
          store.dispatch(editTable());
        }
      }
    }

    relationshipMenus.forEach(relationshipMenu => {
      if (keymapMatchAndOption(event, keymap[relationshipMenu.keymapName])) {
        // store.dispatch(drawStartRelationship(relationshipMenu.relationshipType));
      }
    });

    keymapMatchAndOption(event, keymap.undo) && store.undo();
    keymapMatchAndOption(event, keymap.redo) && store.redo();
  };

  beforeMount(() => {
    const { helper } = contextRef.value;
    subscriptionHelper.push(helper.keydown$.subscribe(onKeydown));
  });

  unmounted(() => subscriptionHelper.destroy());
}
