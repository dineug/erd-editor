import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { keymapOptionToString, keymapOptionsToString } from '@/core/keymap';
import { Drawer } from '@/core/helper/event.helper';
import { changeColumnPrimaryKey$ } from '@/engine/command/column.cmd.helper';

const defaultOptions: MenuOptions = {
  nameWidth: 100,
  keymapWidth: 75,
};

export const createTableMenus = (
  { keymap, eventBus, store }: IERDEditorContext,
  tableId: string
): Menu[] =>
  [
    {
      icon: {
        prefix: 'fas',
        name: 'key',
      },
      name: 'Primary Key',
      keymap: keymapOptionToString(keymap.primaryKey[0]),
      keymapTooltip: keymapOptionsToString(keymap.primaryKey),
      execute() {
        const { editorState } = store;

        if (
          editorState.focusTable &&
          !editorState.focusTable.edit &&
          editorState.focusTable.columnId
        ) {
          store.dispatch(
            changeColumnPrimaryKey$(
              store,
              editorState.focusTable.table.id,
              editorState.focusTable.columnId
            )
          );
        }
      },
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'table-cog',
        size: 18,
      },
      name: 'Table Properties',
      keymap: keymapOptionToString(keymap.tableProperties[0]),
      keymapTooltip: keymapOptionsToString(keymap.tableProperties),
      execute: () =>
        eventBus.emit(Drawer.openTableProperties, {
          tableId,
        }),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
