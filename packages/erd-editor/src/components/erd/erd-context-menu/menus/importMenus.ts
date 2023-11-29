import { AppContext } from '@/components/appContext';
import { importJSON, importSchemaSQL } from '@/utils/file/importFile';

export function createImportMenus(app: AppContext, onClose: () => void) {
  return [
    {
      icon: {
        prefix: 'mdi',
        name: 'code-json',
      },
      name: 'json',
      onClick: () => {
        importJSON(app);
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
        importSchemaSQL(app);
        onClose();
      },
    },
  ];
}
