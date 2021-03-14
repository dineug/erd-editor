import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import {
  createJsonStringify,
  exportPNG,
  exportJSON,
  exportSQLDDL,
} from '@/core/file';
import { createDDL } from '@/core/sql/ddl';

const defaultOptions: MenuOptions = {
  nameWidth: 60,
  keymapWidth: 0,
};

export const createExportMenus = (
  { store }: ERDEditorContext,
  canvas: Element
): Menu[] =>
  [
    {
      name: 'json',
      execute: () =>
        exportJSON(
          createJsonStringify(store, 2),
          store.canvasState.databaseName
        ),
    },
    {
      name: 'SQL DDL',
      execute: () =>
        exportSQLDDL(createDDL(store), store.canvasState.databaseName),
    },
    {
      icon: {
        prefix: 'fas',
        name: 'file-image',
      },
      name: 'png',
      execute: () => exportPNG(canvas, store.canvasState.databaseName),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
