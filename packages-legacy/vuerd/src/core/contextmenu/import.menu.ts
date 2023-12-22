import { importJSON, importLiquibase, importSQLDDL } from '@/core/file';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { Menu, MenuOptions } from '@@types/core/contextmenu';

const defaultOptions: MenuOptions = {
  nameWidth: 60,
  keymapWidth: 0,
};

const liquibaseOptions: MenuOptions = {
  nameWidth: 75,
  keymapWidth: 0,
};

export const createImportMenus = (context: IERDEditorContext): Menu[] =>
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
