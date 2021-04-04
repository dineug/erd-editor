import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { highlightThemes } from '@/engine/store/canvas.state';
import { changeHighlightTheme } from '@/engine/command/canvas.cmd.helper';

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
