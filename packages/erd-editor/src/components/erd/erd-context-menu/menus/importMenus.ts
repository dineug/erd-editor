import { AppContext } from '@/components/appContext';
import { IconName } from '@/components/primitives/icon/icons';
import type { PlainMessageKey } from '@/i18n/translate';
import {
  importAML,
  importDBML,
  importGraphQL,
  importJSON,
  type ImportMode,
  importSchemaSQL,
} from '@/utils/file/importFile';

type Menu = {
  icon: IconName;
  name: string;
  labelKey?: PlainMessageKey;
  onClick: () => void;
};

/** The five formats of the Import menu, or of Import and Add for an append. */
export function createImportMenus(
  app: AppContext,
  onClose: () => void,
  mode: ImportMode = 'replace'
): Menu[] {
  return [
    {
      icon: 'braces',
      name: 'json',
      onClick: () => {
        importJSON(app, mode);
        onClose();
      },
    },
    {
      icon: 'database',
      name: 'Schema SQL',
      labelKey: 'common.tab.schemaSql',
      onClick: () => {
        importSchemaSQL(app, mode);
        onClose();
      },
    },
    {
      icon: 'code',
      name: 'GraphQL',
      onClick: () => {
        importGraphQL(app, mode);
        onClose();
      },
    },
    {
      icon: 'code',
      name: 'DBML',
      onClick: () => {
        importDBML(app, mode);
        onClose();
      },
    },
    {
      icon: 'code',
      name: 'AML',
      onClick: () => {
        importAML(app, mode);
        onClose();
      },
    },
  ];
}
