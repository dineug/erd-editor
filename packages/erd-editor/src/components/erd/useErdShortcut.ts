import { onMounted } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { useAppContext } from '@/components/appContext';
import { CanvasType, RelationshipType } from '@/constants/schema';
import {
  drawEndRelationshipAction,
  editTableAction,
  editTableEndAction,
  focusMoveTableAction,
  selectAllAction,
  selectAllColumnAction,
} from '@/engine/modules/editor/atom.actions';
import {
  drawStartRelationshipAction$,
  focusMoveTableAction$,
  removeSelectedAction$,
  unselectAllAction$,
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
} from '@/engine/modules/table-column/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Ctx } from '@/internal-types';
import { focusEvent, forceFocusEvent } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { isHighLevelTable } from '@/utils/validation';

const isRelationshipKeyBindingName = arrayHas<string>([
  KeyBindingName.relationshipZeroOne,
  KeyBindingName.relationshipZeroN,
  KeyBindingName.relationshipOneOnly,
  KeyBindingName.relationshipOneN,
]);

const keyBindingNameToRelationshipType: Record<string, number> = {
  [KeyBindingName.relationshipZeroOne]: RelationshipType.ZeroOne,
  [KeyBindingName.relationshipZeroN]: RelationshipType.ZeroN,
  [KeyBindingName.relationshipOneOnly]: RelationshipType.OneOnly,
  [KeyBindingName.relationshipOneN]: RelationshipType.OneN,
};

export function useErdShortcut(ctx: Ctx) {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  const handleKeydown = (event: KeyboardEvent) => {
    const { store } = app.value;
    const { editor, settings } = store.state;
    const showHighLevelTable = isHighLevelTable(settings.zoomLevel);

    if (
      settings.canvasType !== CanvasType.ERD ||
      showHighLevelTable ||
      editor.runAutomaticTablePlacement
    ) {
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

  const handleShortcut = ({
    type,
  }: {
    type: KeyBindingName;
    event: KeyboardEvent;
  }) => {
    const { store } = app.value;
    const { editor, settings } = store.state;
    const showHighLevelTable = isHighLevelTable(settings.zoomLevel);

    if (
      settings.canvasType !== CanvasType.ERD ||
      editor.runAutomaticTablePlacement
    ) {
      return;
    }

    if (!editor.focusTable || !editor.focusTable.edit) {
      type === KeyBindingName.addTable && store.dispatch(addTableAction$());
      type === KeyBindingName.addColumn && store.dispatch(addColumnAction$());
      type === KeyBindingName.addMemo && store.dispatch(addMemoAction$());

      type === KeyBindingName.selectAllTable &&
        store.dispatch(selectAllAction());

      if (isRelationshipKeyBindingName(type)) {
        const relationshipType = keyBindingNameToRelationshipType[type];
        store.dispatch(drawStartRelationshipAction$(relationshipType));
      }

      if (type === KeyBindingName.removeTable) {
        ctx.host.dispatchEvent(focusEvent());
        store.dispatch(removeSelectedAction$());
      }

      // KeyBindingName.tableProperties

      // KeyBindingName.find

      type === KeyBindingName.zoomIn &&
        store.dispatch(streamZoomLevelAction({ value: 0.1 }));
      type === KeyBindingName.zoomOut &&
        store.dispatch(streamZoomLevelAction({ value: -0.1 }));
    }

    if (!showHighLevelTable) {
      if (editor.focusTable && !editor.focusTable.edit) {
        type === KeyBindingName.selectAllColumn &&
          store.dispatch(selectAllColumnAction());

        if (
          type === KeyBindingName.removeColumn &&
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

        if (type === KeyBindingName.primaryKey && editor.focusTable.columnId) {
          store.dispatch(
            changeColumnPrimaryKeyAction$(
              editor.focusTable.tableId,
              editor.focusTable.columnId
            )
          );
        }
      }

      if (editor.focusTable && type === KeyBindingName.edit) {
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
    }

    if (type === KeyBindingName.stop) {
      ctx.host.dispatchEvent(forceFocusEvent());
      store.dispatch(drawEndRelationshipAction(), unselectAllAction$());
    }

    type === KeyBindingName.undo && store.undo();
    type === KeyBindingName.redo && store.redo();
  };

  onMounted(() => {
    const { keydown$, shortcut$ } = app.value;

    addUnsubscribe(
      keydown$.subscribe(handleKeydown),
      shortcut$.subscribe(handleShortcut)
    );
  });
}
