import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';

const defaultOptions: MenuOptions = {
  nameWidth: 60,
  keymapWidth: 0,
};

export const createExportMenus = (context: ERDEditorContext): Menu[] =>
  [
    {
      name: 'json',
      execute() {
        // exportJSON(createJsonStringify(store, 2), canvasState.databaseName);
      },
    },
    {
      name: 'SQL DDL',
      execute() {
        // exportSQLDDL(createDDL(store), canvasState.databaseName);
      },
    },
    {
      icon: {
        prefix: 'fas',
        name: 'file-image',
      },
      name: 'png',
      execute() {
        // exportPNG(root, '.vuerd-canvas', canvasState.databaseName);
      },
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
