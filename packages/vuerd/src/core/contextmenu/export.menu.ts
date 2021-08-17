import {
  createJsonStringify,
  createStoreCopy,
  exportJSON,
  exportPNG,
  exportSQLDDL,
  exportXML,
} from '@/core/file';
import { createLiquibase } from '@/core/parser/JSONToLiquibase';
import { createDDL } from '@/core/sql/ddl';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ExportedStore } from '@@types/engine/store';

const defaultOptions: MenuOptions = {
  nameWidth: 60,
  keymapWidth: 0,
};

export const getLatestSnapshot = (
  snapshots: ExportedStore[]
): ExportedStore | undefined => {
  return snapshots[snapshots.length - 1];
};

export const createExportMenus = (
  { store, snapshots, showPrompt, showAlert }: IERDEditorContext,
  canvas: Element
): Menu[] =>
  [
    {
      icon: {
        prefix: 'mdi',
        name: 'code-json',
        size: 18,
      },
      name: 'json',
      execute: () =>
        exportJSON(
          createJsonStringify(store, 2),
          store.canvasState.databaseName
        ),
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'database-export',
        size: 18,
      },
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
    {
      icon: {
        prefix: 'mdi',
        name: 'xml',
        size: 18,
      },
      name: 'Liquibase',
      execute: () => {
        if (store.canvasState.database === 'PostgreSQL') {
          showPrompt('Please enter the name of changeset:', id =>
            showPrompt('Please enter name of the author:', name => {
              const liquibase = createLiquibase(
                store,
                id,
                name,
                getLatestSnapshot(snapshots)
              );

              exportXML(liquibase, store.canvasState.databaseName);

              if (liquibase) {
                snapshots.push(createStoreCopy(store));
                console.log('AFTER', snapshots);
              }
            })
          );
        } else {
          showAlert(
            `Export from ${store.canvasState.database} dialect not supported, please use PostgreSQL`
          );
        }
      },
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
