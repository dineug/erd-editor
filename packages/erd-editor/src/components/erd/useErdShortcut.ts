import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import {
  editTableAction,
  editTableEndAction,
  focusMoveTableAction,
  selectAllAction,
  selectAllColumnAction,
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
  changeColumnPrimaryKeyAction$,
  isToggleColumnTypes,
  removeColumnAction$,
  toggleColumnValueAction$,
} from '@/engine/modules/tableColumn/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const CanvasType = SchemaV3Constants.CanvasType;

export function useErdShortcut(ctx: Parameters<typeof useAppContext>[0]) {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  const handleKeydown = (event: KeyboardEvent) => {
    const { store } = app.value;
    const { editor, settings } = store.state;
    if (settings.canvasType !== CanvasType.ERD) {
      return;
    }

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

      window.setTimeout(() => {
        if (
          !editor.focusTable ||
          isToggleColumnTypes(editor.focusTable.focusType)
        ) {
          return;
        }

        store.dispatch(editTableAction());
      }, 1);
    }
  };

  const handleShortcut = (action: KeyBindingName) => {
    const { store } = app.value;
    const { editor, settings } = store.state;
    if (settings.canvasType !== CanvasType.ERD) {
      return;
    }

    if (!editor.focusTable || !editor.focusTable.edit) {
      action === KeyBindingName.addTable && store.dispatch(addTableAction$());
      action === KeyBindingName.addColumn && store.dispatch(addColumnAction$());
      action === KeyBindingName.addMemo && store.dispatch(addMemoAction$());

      action === KeyBindingName.selectAllTable &&
        store.dispatch(selectAllAction());

      // drawStartRelationship

      action === KeyBindingName.removeTable &&
        store.dispatch(removeSelectedAction$());

      // KeyBindingName.tableProperties

      // KeyBindingName.find

      action === KeyBindingName.zoomIn &&
        store.dispatch(streamZoomLevelAction({ value: 0.1 }));
      action === KeyBindingName.zoomOut &&
        store.dispatch(streamZoomLevelAction({ value: -0.1 }));
    }

    if (editor.focusTable && !editor.focusTable.edit) {
      action === KeyBindingName.selectAllColumn &&
        store.dispatch(selectAllColumnAction());

      if (
        action === KeyBindingName.removeColumn &&
        editor.focusTable.selectColumnIds.length
      ) {
        store.dispatch(
          removeColumnAction$(
            editor.focusTable.tableId,
            editor.focusTable.selectColumnIds
          )
        );
      }

      // KeyBindingName.copyColumn
      // KeyBindingName.pasteColumn

      if (action === KeyBindingName.primaryKey && editor.focusTable.columnId) {
        store.dispatch(
          changeColumnPrimaryKeyAction$(
            editor.focusTable.tableId,
            editor.focusTable.columnId
          )
        );
      }
    }

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

    if (action === KeyBindingName.stop) {
      // drawEndRelationship
    }

    action === KeyBindingName.undo && store.undo();
    action === KeyBindingName.redo && store.redo();
  };

  onMounted(() => {
    const { keydown$, shortcut$ } = app.value;

    addUnsubscribe(
      keydown$.subscribe(handleKeydown),
      shortcut$.subscribe(handleShortcut)
    );
  });
}
