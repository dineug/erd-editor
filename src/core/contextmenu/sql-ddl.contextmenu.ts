import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { createDatabaseMenus } from './database.contextmenu';
import { crateHighlightTheme } from './highlightTheme.contextmenu';

const defaultOptions: MenuOptions = {
  nameWidth: 100,
  keymapWidth: 0,
};

export const createSQLDDLMenus = (context: ERDEditorContext): Menu[] =>
  [
    {
      icon: {
        prefix: 'mdi',
        name: 'database',
        size: 18,
      },
      name: 'Database',
      children: createDatabaseMenus(context),
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'palette',
        size: 18,
      },
      name: 'Highlight Theme',
      children: crateHighlightTheme(context),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
