import { toJson } from '@dineug/erd-editor-schema';
import { nextTick } from '@dineug/r-html';

import { AppContext } from '@/components/appContext';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import {
  exportJSON,
  exportPNG,
  exportSchemaSQL,
} from '@/utils/file/exportFile';

export function createExportMenus(
  app: AppContext,
  onClose: () => void,
  root: HTMLElement
) {
  const { store } = app;
  const databaseName = store.state.settings.databaseName;

  return [
    {
      icon: {
        prefix: 'mdi',
        name: 'code-json',
      },
      name: 'json',
      onClick: () => {
        exportJSON(toJson(store.state), databaseName);
        onClose();
      },
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'database-import',
      },
      name: 'Schema SQL',
      onClick: () => {
        // TODO: exportSQLDDL
        console.log('exportSchemaSQL');
        // exportSchemaSQL(createSchemaSQL(store), store.state.settings.databaseName);
        onClose();
      },
    },
    {
      icon: {
        prefix: 'fas',
        name: 'file-image',
      },
      name: 'png',
      onClick: () => {
        onClose();
        store.dispatchSync(
          scrollToAction({
            scrollTop: 0,
            scrollLeft: 0,
          })
        );
        nextTick(() => {
          exportPNG(root, databaseName);
        });
      },
    },
  ];
}
