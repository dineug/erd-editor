import { AppContext } from '@/components/appContext';
import { IconName } from '@/components/primitives/icon/icons';
import {
  importAML,
  importDBML,
  importGraphQL,
  importJSON,
  importSchemaSQL,
} from '@/utils/file/importFile';

type Menu = {
  icon: IconName;
  name: string;
  onClick: () => void;
};

export function createImportMenus(
  app: AppContext,
  onClose: () => void
): Menu[] {
  return [
    {
      icon: 'braces',
      name: 'json',
      onClick: () => {
        importJSON(app);
        onClose();
      },
    },
    {
      icon: 'database',
      name: 'Schema SQL',
      onClick: () => {
        importSchemaSQL(app);
        onClose();
      },
    },
    {
      icon: 'code',
      name: 'GraphQL',
      onClick: () => {
        importGraphQL(app);
        onClose();
      },
    },
    {
      icon: 'code',
      name: 'DBML',
      onClick: () => {
        importDBML(app);
        onClose();
      },
    },
    {
      icon: 'code',
      name: 'AML',
      onClick: () => {
        importAML(app);
        onClose();
      },
    },
  ];
}
