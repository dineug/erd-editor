import { toJson } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/appContext';
import {
  exportJSON,
  exportPNG,
  exportSchemaSQL,
} from '@/utils/file/exportFile';
import { createSchemaSQL } from '@/utils/schema-sql';

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
        onClose();
        exportJSON(toJson(store.state), databaseName);
      },
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'database-export',
      },
      name: 'Schema SQL',
      onClick: () => {
        onClose();
        exportSchemaSQL(createSchemaSQL(store.state), databaseName);
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
        exportPNG(root, databaseName);
      },
    },
  ];
}
