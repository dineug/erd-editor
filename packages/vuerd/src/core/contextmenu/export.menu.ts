import {
  createJsonStringify,
  createSnapshot,
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
import { Snapshot } from '@@types/engine/store/snapshot';

const defaultOptions: MenuOptions = {
  nameWidth: 60,
  keymapWidth: 0,
};

export const getLatestSnapshot = (context: IERDEditorContext): Snapshot => {
  if (context.snapshots.length) {
    return context.snapshots[context.snapshots.length - 1];
  } else {
    const snapshot: Snapshot = {
      data: createStoreCopy(context.store),
      metadata: { type: 'user', filename: '' },
    };
    snapshot.data.relationship.relationships = [];
    snapshot.data.table.indexes = [];
    snapshot.data.table.tables = [];

    return snapshot;
  }
};

export const createExportMenus = (
  context: IERDEditorContext,
  canvas: Element
): Menu[] => {
  const { store, snapshots, showPrompt, showAlert } = context;
  return [
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
              id = id.replace(/\\/g, '/');
              const fileName = `${id.replace(/\.xml$/g, '')}.xml`;

              createSnapshot(context, {
                type: 'before-export',
                filename: fileName,
              });

              const liquibase = createLiquibase(context, id, name);

              exportXML(liquibase, fileName);

              if (liquibase) {
                createSnapshot(context, {
                  type: 'after-export',
                  filename: fileName,
                });
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
};
