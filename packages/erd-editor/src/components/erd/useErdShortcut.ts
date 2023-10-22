import { onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import { selectAllAction } from '@/engine/modules/editor/atom.actions';
import { removeSelectedAction$ } from '@/engine/modules/editor/generator.actions';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { streamZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/tableColumn/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

export function useErdShortcut(ctx: Parameters<typeof useAppContext>[0]) {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  onMounted(() => {
    const { store, shortcut$ } = app.value;

    addUnsubscribe(
      shortcut$.subscribe(action => {
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
