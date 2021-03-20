import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { databaseList } from '@/engine/store/canvas.state';

const defaultOptions: MenuOptions = {
  nameWidth: 80,
  keymapWidth: 0,
  close: false,
};

export const createDatabaseMenus = ({
  store,
  command,
}: ERDEditorContext): Menu[] =>
  databaseList.map(databaseType => ({
    icon:
      store.canvasState.database === databaseType
        ? {
            prefix: 'fas',
            name: 'check',
          }
        : undefined,
    name: databaseType,
    execute: () => store.dispatch(command.canvas.changeDatabase(databaseType)),
    options: {
      ...defaultOptions,
    },
  }));
