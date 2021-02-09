import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { ShowKey } from '@@types/engine/store/canvas.state';

interface ShowMenu {
  name: string;
  showKey: ShowKey;
}

const showMenus: ShowMenu[] = [
  {
    name: 'Table Comment',
    showKey: 'tableComment',
  },
  {
    name: 'Column Comment',
    showKey: 'columnComment',
  },
  {
    name: 'DataType',
    showKey: 'columnDataType',
  },
  {
    name: 'Default',
    showKey: 'columnDefault',
  },
  {
    name: 'Not Null',
    showKey: 'columnNotNull',
  },
  {
    name: 'Unique',
    showKey: 'columnUnique',
  },
  {
    name: 'Auto Increment',
    showKey: 'columnAutoIncrement',
  },
  {
    name: 'Relationship',
    showKey: 'relationship',
  },
];

const defaultOptions: MenuOptions = {
  nameWidth: 105,
  keymapWidth: 0,
  close: false,
};

export const createShowMenus = ({ store, command }: ERDEditorContext): Menu[] =>
  showMenus.map(showMenu => ({
    icon: store.canvasState.show[showMenu.showKey]
      ? {
          prefix: 'fas',
          name: 'check',
        }
      : undefined,
    name: showMenu.name,
    execute() {
      store.dispatch(command.canvas.changeCanvasShow(store, showMenu.showKey));
    },
    options: {
      ...defaultOptions,
    },
  }));
