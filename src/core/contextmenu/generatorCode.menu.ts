import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { createLanguageMenus } from './language.menu';
import { createHighlightThemeMenus } from './highlightTheme.menu';
import { createTableNameCaseMenus } from './tableNameCase.menu';
import { createColumnNameCaseMenus } from './columnNameCase.menu';

const defaultOptions: MenuOptions = {
  nameWidth: 120,
  keymapWidth: 0,
};

export const createGeneratorCodeMenus = (context: ERDEditorContext): Menu[] =>
  [
    {
      icon: {
        prefix: 'fas',
        name: 'code',
      },
      name: 'Language',
      children: createLanguageMenus(context),
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'format-letter-case',
        size: 18,
      },
      name: 'Table Name Case',
      children: createTableNameCaseMenus(context),
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'format-letter-case',
        size: 18,
      },
      name: 'Column Name Case',
      children: createColumnNameCaseMenus(context),
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
