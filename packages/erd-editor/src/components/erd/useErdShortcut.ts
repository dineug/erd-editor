import { nextTick, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import {
  editTableAction,
  editTableEndAction,
  focusMoveTableAction,
  selectAllAction,
} from '@/engine/modules/editor/atom.actions';
import {
  focusMoveTableAction$,
  removeSelectedAction$,
} from '@/engine/modules/editor/generator.actions';
import { hasMoveKeys, MoveKey } from '@/engine/modules/editor/state';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { streamZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  addColumnAction$,
  isToggleColumnTypes,
  toggleColumnValueAction$,
} from '@/engine/modules/tableColumn/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

export function useErdShortcut(ctx: Parameters<typeof useAppContext>[0]) {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  onMounted(() => {
    const { store, shortcut$, keydown$ } = app.value;

    addUnsubscribe(
      keydown$.subscribe(event => {
        const { editor } = store.state;

        if (
          editor.focusTable &&
          !editor.focusTable.edit &&
          event.key !== MoveKey.Tab &&
          hasMoveKeys(event.key)
        ) {
          store.dispatch(
            focusMoveTableAction({
              moveKey: event.key,
              shiftKey: event.shiftKey,
            })
          );
        }

        if (editor.focusTable && event.key === MoveKey.Tab) {
          event.preventDefault();
          store.dispatch(focusMoveTableAction$(event.key, event.shiftKey));

          nextTick(() => {
            if (
              !editor.focusTable ||
              isToggleColumnTypes(editor.focusTable.focusType)
            ) {
              return;
            }

            store.dispatch(editTableAction());
          });
        }
      }),
      shortcut$.subscribe(action => {
        const { editor } = store.state;

        if (editor.focusTable && action === KeyBindingName.edit) {
          const focusTable = editor.focusTable;

          if (focusTable.edit) {
            store.dispatch(editTableEndAction());
          } else if (
            focusTable.columnId &&
            isToggleColumnTypes(focusTable.focusType)
          ) {
            store.dispatch(
              toggleColumnValueAction$(
                focusTable.focusType,
                focusTable.tableId,
                focusTable.columnId
              )
            );
          } else {
            store.dispatch(editTableAction());
          }
        }

        switch (action) {
          case KeyBindingName.edit:
            break;
          case KeyBindingName.stop:
            break;
          case KeyBindingName.find:
            break;
          case KeyBindingName.undo:
            store.undo();
            break;
          case KeyBindingName.redo:
            store.redo();
            break;
          case KeyBindingName.addTable:
            store.dispatch(addTableAction$());
            break;
          case KeyBindingName.addColumn:
            store.dispatch(addColumnAction$());
            break;
          case KeyBindingName.addMemo:
            store.dispatch(addMemoAction$());
            break;
          case KeyBindingName.removeTable:
            store.dispatch(removeSelectedAction$());
            break;
          case KeyBindingName.removeColumn:
            break;
          case KeyBindingName.primaryKey:
            break;
          case KeyBindingName.selectAllTable:
            store.dispatch(selectAllAction());
            break;
          case KeyBindingName.selectAllColumn:
            break;
          case KeyBindingName.copyColumn:
            break;
          case KeyBindingName.pasteColumn:
            break;
          case KeyBindingName.relationshipZeroOne:
            break;
          case KeyBindingName.relationshipZeroN:
            break;
          case KeyBindingName.relationshipOneOnly:
            break;
          case KeyBindingName.relationshipOneN:
            break;
          case KeyBindingName.tableProperties:
            break;
          case KeyBindingName.zoomIn:
            store.dispatch(streamZoomLevelAction({ value: 0.1 }));
            break;
          case KeyBindingName.zoomOut:
            store.dispatch(streamZoomLevelAction({ value: -0.1 }));
            break;
        }
      })
    );
  });
}
