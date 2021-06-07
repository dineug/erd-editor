import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { importJSON, importSQLDDL, importXML } from '@/core/file';

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
    {
      icon: {
        prefix: 'mdi',
        name: 'xml',
        size: 18,
      },
      name: 'XML (WIP)',
      execute: () => importXML(context),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
