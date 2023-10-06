import { AppContext } from '@/components/context';

export function createExportMenus(app: AppContext, onClose: () => void) {
  return [
    {
      icon: {
        prefix: 'mdi',
        name: 'code-json',
      },
      name: 'json',
      onClick: () => {
        // TODO: exportJSON
        console.log('exportJSON');
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
        // TODO: exportSQLDDL
        console.log('exportSQLDDL');
        onClose();
      },
    },
    {
      icon: {
        prefix: 'fas',
        name: 'file-image',
      },
      name: 'png',
      execute: () => {
        // TODO: exportPNG
        console.log('exportPNG');
        onClose();
      },
    },
  ];
}
