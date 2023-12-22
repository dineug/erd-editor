import { changeHighlightTheme } from '@/engine/command/canvas.cmd.helper';
import { highlightThemes } from '@/engine/store/canvas.state';
import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';

const defaultOptions: MenuOptions = {
  nameWidth: 105,
  keymapWidth: 0,
  close: false,
};

export const createHighlightThemeMenus = ({
  store,
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
    execute: () => store.dispatch(changeHighlightTheme(highlightTheme)),
    options: {
      ...defaultOptions,
    },
  }));
