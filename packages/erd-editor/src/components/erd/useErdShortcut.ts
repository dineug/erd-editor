import { onMounted } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { useAppContext } from '@/components/appContext';
import { Open } from '@/constants/open';
import { RelationshipType } from '@/constants/schema';
import {
  changeOpenMapAction,
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
import {
  hasMoveKeys,
  MoveKey,
  SelectType,
} from '@/engine/modules/editor/state';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { streamZoomLevelAction$ } from '@/engine/modules/settings/generator.actions';
import {
  addTableAction$,
  pasteTableAction$,
} from '@/engine/modules/table/generator.actions';
import {
  addColumnAction$,
  changeColumnPrimaryKeyAction$,
  isToggleColumnTypes,
  removeColumnAction$,
  toggleColumnValueAction$,
} from '@/engine/modules/table-column/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Column, Ctx } from '@/internal-types';
import { openTablePropertiesAction } from '@/utils/emitter';
import { focusEvent, forceFocusEvent } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { fromCopy } from '@/utils/rx-operators/fromCopy';
import { fromPaste } from '@/utils/rx-operators/fromPaste';
import { tableCopyToHtml, tableCopyToText } from '@/utils/table-clipboard/copy';
import {
  tablePasteFromHtmlToColumns,
  tablePasteFromTextToColumns,
} from '@/utils/table-clipboard/paste';
import { isHighLevelTable } from '@/utils/validation';

import { erdShortcutPerformCheck } from './erdShortcutPerformCheck';

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

    if (showHighLevelTable) {
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

      setTimeout(() => {
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
    const { store, emitter } = app.value;
    const { editor, settings } = store.state;
    const showHighLevelTable = isHighLevelTable(settings.zoomLevel);

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

      if (type === KeyBindingName.tableProperties) {
        const selectedTable = Object.entries(editor.selectedMap).find(
          ([, type]) => type === SelectType.table
        );

        if (selectedTable) {
          emitter.emit(
            openTablePropertiesAction({ tableId: selectedTable[0] })
          );
          store.dispatch(changeOpenMapAction({ [Open.tableProperties]: true }));
        }
      }

      type === KeyBindingName.zoomIn &&
        store.dispatch(streamZoomLevelAction$(0.1));
      type === KeyBindingName.zoomOut &&
        store.dispatch(streamZoomLevelAction$(-0.1));
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

  const handleCopy = (event: ClipboardEvent) => {
    const { store } = app.value;
    const { editor, settings } = store.state;
    const showHighLevelTable = isHighLevelTable(settings.zoomLevel);

    if (
      !showHighLevelTable &&
      editor.focusTable &&
      !editor.focusTable.edit &&
      editor.focusTable.selectColumnIds.length !== 0 &&
      event.clipboardData
    ) {
      event.preventDefault();
      event.clipboardData.clearData();
      event.clipboardData.setData('text/plain', tableCopyToText(store.state));
      event.clipboardData.setData('text/html', tableCopyToHtml(store.state));
    }
  };

  const handlePaste = (event: ClipboardEvent) => {
    const { store } = app.value;
    const { editor, settings } = store.state;
    const showHighLevelTable = isHighLevelTable(settings.zoomLevel);
    if (showHighLevelTable || editor.focusTable?.edit || !event.clipboardData) {
      return;
    }

    const selectedTables = Object.entries(editor.selectedMap).filter(
      ([, type]) => type === SelectType.table
    );
    if (selectedTables.length === 0) return;

    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    let columns: Column[] = [];

    if (html.trim()) {
      columns = tablePasteFromHtmlToColumns(store.state, html);
    } else if (text.trim()) {
      columns = tablePasteFromTextToColumns(store.state, text);
    }

    if (columns.length === 0) return;

    event.preventDefault();
    store.dispatch(pasteTableAction$(columns));
  };

  onMounted(() => {
    const { store, keydown$, shortcut$, emitter } = app.value;

    addUnsubscribe(
      keydown$
        .pipe(erdShortcutPerformCheck(store.state))
        .subscribe(handleKeydown),
      shortcut$
        .pipe(erdShortcutPerformCheck(store.state))
        .subscribe(handleShortcut),
      fromCopy(emitter)
        .pipe(erdShortcutPerformCheck(store.state))
        .subscribe(handleCopy),
      fromPaste(emitter)
        .pipe(erdShortcutPerformCheck(store.state))
        .subscribe(handlePaste)
    );
  });
}
