import { Bus } from '@/core/helper/eventBus.helper';
import { keymapOptionsToString, keymapOptionToString } from '@/core/keymap';
import { changeColumnPrimaryKey$ } from '@/engine/command/column.cmd.helper';
import { addTableDefault$ } from '@/engine/command/table.cmd.helper';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { Menu, MenuOptions } from '@@types/core/contextmenu';

const defaultOptions: MenuOptions = {
  nameWidth: 105,
  keymapWidth: 100,
};

export const createTableMenus = (
  { keymap, eventBus, store, helper }: IERDEditorContext,
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
        eventBus.emit(Bus.Drawer.openTableProperties, {
          tableId,
        }),
    },
    {
      icon: {
        prefix: 'fas',
        name: 'columns',
      },
      name: 'Default Template',
      execute: () => store.dispatch(addTableDefault$(tableId, helper)),
    },
    {
      icon: {
        prefix: 'fas',
        name: 'palette',
      },
      name: 'Color',
      execute: () => eventBus.emit(Bus.ColorPicker.open, tableId),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
