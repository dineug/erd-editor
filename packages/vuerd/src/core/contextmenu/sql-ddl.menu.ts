import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { createDatabaseMenus } from './database.menu';
import { createHighlightThemeMenus } from './highlightTheme.menu';
import { createBracketTypeMenus } from './bracketType.menu';

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
        name: 'code-brackets',
        size: 18,
      },
      name: 'Bracket',
      children: createBracketTypeMenus(context),
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'palette',
        size: 18,
      },
      name: 'Highlight Theme',
      children: createHighlightThemeMenus(context),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
