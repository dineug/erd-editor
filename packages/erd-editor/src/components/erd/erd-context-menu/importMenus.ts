import { AppContext } from '@/components/context';

export function createImportMenus(app: AppContext, onClose: () => void) {
  return [
    {
      icon: {
        prefix: 'mdi',
        name: 'code-json',
      },
      name: 'json',
      onClick: () => {
        // TODO: importJSON
        console.log('importJSON');
        onClose();
      },
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'database-import',
      },
      name: 'SQL DDL',
      onClick: () => {
        // TODO: importSQLDDL
        console.log('importSQLDDL');
        onClose();
      },
    },
  ];
}
