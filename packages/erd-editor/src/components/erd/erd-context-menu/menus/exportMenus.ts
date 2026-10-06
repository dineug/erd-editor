import { toJson } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/appContext';
import { IconName } from '@/components/primitives/icon/icons';
import { sourceI18n } from '@/i18n/source';
import type { I18n } from '@/i18n/translate';
import { openExportImageAction } from '@/utils/emitter';
import { exportJSON, exportSchemaSQL } from '@/utils/file/exportFile';
import { createSchemaSQL } from '@/utils/schema-sql';

type Menu = {
  icon: IconName;
  name: string;
  onClick: () => void;
};

/** The Export rows: json by its format's name, Schema SQL and Image in the reader's language. */
export function createExportMenus(
  app: AppContext,
  onClose: () => void,
  i18n: Pick<I18n, 't'> = sourceI18n
): Menu[] {
  const { store, emitter } = app;
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
      name: i18n.t('common.tab.schemaSql'),
      onClick: () => {
        onClose();
        exportSchemaSQL(createSchemaSQL(store.state), databaseName);
      },
    },
    {
      icon: 'file-image',
      name: i18n.t('common.image'),
      onClick: () => {
        onClose();
        emitter.emit(openExportImageAction());
      },
    },
  ];
}
