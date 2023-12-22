import { changeBracketType } from '@/engine/command/canvas.cmd.helper';
import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { BracketType } from '@@types/engine/store/canvas.state';

const defaultOptions: MenuOptions = {
  nameWidth: 85,
  keymapWidth: 0,
  close: false,
};

interface BracketTypeMenu {
  name: string;
  bracketType: BracketType;
}

const bracketTypeMenus: BracketTypeMenu[] = [
  {
    name: 'SingleQuote',
    bracketType: 'singleQuote',
  },
  {
    name: 'DoubleQuote',
    bracketType: 'doubleQuote',
  },
  {
    name: 'Backtick',
    bracketType: 'backtick',
  },
  {
    name: 'None',
    bracketType: 'none',
  },
];

export const createBracketTypeMenus = ({ store }: ERDEditorContext): Menu[] =>
  bracketTypeMenus.map(menu => ({
    icon:
      store.canvasState.bracketType === menu.bracketType
        ? {
            prefix: 'fas',
            name: 'check',
          }
        : undefined,
    name: menu.name,
    execute: () => store.dispatch(changeBracketType(menu.bracketType)),
    options: {
      ...defaultOptions,
    },
  }));
