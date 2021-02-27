import { CommandTypeAll } from '@@types/engine/command';
import { MoveKey } from '@@types/engine/store/editor.state';
import { beforeMount, unmounted } from '@dineug/lit-observable';
import { useContext } from './context.hook';
import { createSubscriptionHelper } from '@/core/helper';
import { keymapMatchAndOption } from '@/core/keymap';
import { relationshipMenus } from '@/core/contextmenu/drawRelationship.contextmenu';
import { moveKeys } from '@/engine/store/editor.state';
import { addColumn$ } from '@/engine/command/column.cmd.helper';
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
import { focusMoveTable$ } from '@/engine/command/editor.cmd.helper';

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

    if (editorState.focusTable && moveKeys.includes(event.key as MoveKey)) {
      event.key === 'Tab' && event.preventDefault();
      store.dispatch(focusMoveTable$(event.key as MoveKey, event.shiftKey));
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
