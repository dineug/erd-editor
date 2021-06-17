import { importJSON, importLiquibase, importSQLDDL } from '@/core/file';
import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';

const defaultOptions: MenuOptions = {
  nameWidth: 60,
  keymapWidth: 0,
};

const liquibaseOptions: MenuOptions = {
  nameWidth: 75,
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
      name: 'Liquibase',
      children: [
        {
          icon: {
            prefix: 'mdi',
            name: 'xml',
            size: 18,
          },
          name: 'PostgreSQL',
          execute: () => importLiquibase(context, 'postgresql'),
        },
        {
          icon: {
            prefix: 'mdi',
            name: 'xml',
            size: 18,
          },
          name: 'Oracle',
          execute: () => importLiquibase(context, 'oracle'),
        },
        {
          icon: {
            prefix: 'mdi',
            name: 'xml',
            size: 18,
          },
          name: 'MSSQL',
          execute: () => importLiquibase(context, 'mssql'),
        },
      ].map(menu => ({ ...menu, options: { ...liquibaseOptions } })),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
