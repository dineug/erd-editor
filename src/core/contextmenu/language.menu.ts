import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { languageList } from '@/engine/store/canvas.state';
import { changeLanguage } from '@/engine/command/canvas.cmd.helper';

const defaultOptions: MenuOptions = {
  nameWidth: 70,
  keymapWidth: 0,
  close: false,
};

export const createLanguageMenus = ({ store }: ERDEditorContext): Menu[] =>
  languageList.map(language => ({
    icon:
      store.canvasState.language === language
        ? {
            prefix: 'fas',
            name: 'check',
          }
        : undefined,
    name: language,
    execute: () => store.dispatch(changeLanguage(language)),
    options: {
      ...defaultOptions,
    },
  }));
