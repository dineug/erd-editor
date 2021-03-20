import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { NameCase } from '@@types/engine/store/canvas.state';

const defaultOptions: MenuOptions = {
  nameWidth: 50,
  keymapWidth: 0,
  close: false,
};

interface NameCaseMenu {
  name: string;
  nameCase: NameCase;
}

const nameCaseMenus: NameCaseMenu[] = [
  {
    name: 'Pascal',
    nameCase: 'pascalCase',
  },
  {
    name: 'Camel',
    nameCase: 'camelCase',
  },
  {
    name: 'Snake',
    nameCase: 'snakeCase',
  },
  {
    name: 'None',
    nameCase: 'none',
  },
];

export const createColumnNameCaseMenus = ({
  store,
  command,
}: ERDEditorContext): Menu[] =>
  nameCaseMenus.map(menu => ({
    icon:
      store.canvasState.columnCase === menu.nameCase
        ? {
            prefix: 'fas',
            name: 'check',
          }
        : undefined,
    name: menu.name,
    execute: () =>
      store.dispatch(command.canvas.changeColumnCase(menu.nameCase)),
    options: {
      ...defaultOptions,
    },
  }));
