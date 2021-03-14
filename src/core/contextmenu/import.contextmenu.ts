import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { importJSON, importSQLDDL } from '@/core/file';

const defaultOptions: MenuOptions = {
  nameWidth: 60,
  keymapWidth: 0,
};

export const createImportMenus = (context: ERDEditorContext): Menu[] =>
  [
    {
      name: 'json',
      execute: () => importJSON(context),
    },
    {
      name: 'SQL DDL',
      execute: () => importSQLDDL(context),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
