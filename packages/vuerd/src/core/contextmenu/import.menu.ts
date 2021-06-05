import { importJSON, importSQLDDL } from '@/core/file';
import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';

const defaultOptions: MenuOptions = {
  nameWidth: 60,
  keymapWidth: 0,
};

export const createImportMenus = (context: ERDEditorContext): Menu[] =>
  [
    {
      icon: {
        prefix: 'mdi',
        name: 'code-json',
        size: 18,
      },
      name: 'json',
      execute: () => importJSON(context),
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'database-import',
        size: 18,
      },
      name: 'SQL DDL',
      execute: () => importSQLDDL(context),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
