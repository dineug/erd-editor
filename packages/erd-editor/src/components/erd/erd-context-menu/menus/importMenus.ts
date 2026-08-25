import { AppContext } from '@/components/appContext';
import {
  importDBML,
  importGraphQL,
  importJSON,
  importSchemaSQL,
} from '@/utils/file/importFile';

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
    {
      icon: {
        prefix: 'mdi',
        name: 'graphql',
      },
      name: 'GraphQL',
      onClick: () => {
        importGraphQL(app);
        onClose();
      },
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'relation-one-to-many',
      },
      name: 'DBML',
      onClick: () => {
        importDBML(app);
        onClose();
      },
    },
  ];
}
