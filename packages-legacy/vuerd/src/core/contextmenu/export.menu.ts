import {
  createJsonStringify,
  createStoreCopy,
  exportJSON,
  exportPNG,
  exportSQLDDL,
} from '@/core/file';
import { createDDL } from '@/core/sql/ddl';
import { moveCanvas } from '@/engine/command/canvas.cmd.helper';
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
  canvas: HTMLElement
): Menu[] => {
  const { store, snapshots, showPrompt, eventBus } = context;
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
      execute: () => {
        store.dispatchSync(moveCanvas(0, 0));
        exportPNG(canvas, store.canvasState.databaseName);
      },
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
};
