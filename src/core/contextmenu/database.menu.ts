import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { databaseList } from '@/engine/store/canvas.state';
import { changeDatabase } from '@/engine/command/canvas.cmd.helper';

const defaultOptions: MenuOptions = {
  nameWidth: 80,
  keymapWidth: 0,
  close: false,
};

export const createDatabaseMenus = ({ store }: ERDEditorContext): Menu[] =>
  databaseList.map(databaseType => ({
    icon:
      store.canvasState.database === databaseType
        ? {
            prefix: 'fas',
            name: 'check',
          }
        : undefined,
    name: databaseType,
    execute: () => store.dispatch(changeDatabase(databaseType)),
    options: {
      ...defaultOptions,
    },
  }));
