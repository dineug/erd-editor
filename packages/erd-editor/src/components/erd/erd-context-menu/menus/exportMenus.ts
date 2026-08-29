import { toJson } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/appContext';
import { IconName } from '@/components/primitives/icon/icons';
import {
  exportJSON,
  exportPNG,
  exportSchemaSQL,
} from '@/utils/file/exportFile';
import { createSchemaSQL } from '@/utils/schema-sql';

type Menu = {
  icon: IconName;
  name: string;
  onClick: () => void;
};

export function createExportMenus(
  app: AppContext,
  onClose: () => void,
  root: HTMLElement
): Menu[] {
  const { store } = app;
  const databaseName = store.state.settings.databaseName;

  return [
    {
      icon: 'braces',
      name: 'json',
      onClick: () => {
        onClose();
        exportJSON(toJson(store.state), databaseName);
      },
    },
    {
      icon: 'database',
      name: 'Schema SQL',
      onClick: () => {
        onClose();
        exportSchemaSQL(createSchemaSQL(store.state), databaseName);
      },
    },
    {
      icon: 'file-image',
      name: 'png',
      onClick: () => {
        onClose();
        exportPNG(root, databaseName);
      },
    },
  ];
}
