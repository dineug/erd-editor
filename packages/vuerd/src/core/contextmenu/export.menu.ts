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
import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
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
  { store, snapshots }: ERDEditorContext,
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
          const editor = document.querySelector('erd-editor');

          editor?.showPrompt('Please enter the name of changeset:', id =>
            editor?.showPrompt('Please enter name of the author:', name => {
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
          alert(
            `Export from ${store.canvasState.database} dialect not supported, please use PostgreSQL`
          );
        }
      },
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
