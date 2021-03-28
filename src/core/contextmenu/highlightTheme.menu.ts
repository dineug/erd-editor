import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { highlightThemes } from '@/engine/store/canvas.state';

const defaultOptions: MenuOptions = {
  nameWidth: 105,
  keymapWidth: 0,
  close: false,
};

export const createHighlightThemeMenus = ({
  store,
  command,
}: ERDEditorContext): Menu[] =>
  highlightThemes.map(highlightTheme => ({
    icon:
      store.canvasState.highlightTheme === highlightTheme
        ? {
            prefix: 'fas',
            name: 'check',
          }
        : undefined,
    name: highlightTheme,
    execute: () =>
      store.dispatch(command.canvas.changeHighlightTheme(highlightTheme)),
    options: {
      ...defaultOptions,
    },
  }));
