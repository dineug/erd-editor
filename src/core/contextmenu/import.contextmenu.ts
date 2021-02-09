import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';

const defaultOptions: MenuOptions = {
  nameWidth: 60,
  keymapWidth: 0,
};

export const createImportMenus = (context: ERDEditorContext): Menu[] =>
  [
    {
      name: 'json',
      execute() {
        // importJSON(store);
      },
    },
    {
      name: 'SQL DDL',
      execute() {
        // importSQL(context);
      },
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
