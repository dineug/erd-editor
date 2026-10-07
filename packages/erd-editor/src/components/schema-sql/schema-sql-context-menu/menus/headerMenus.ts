import type { AppContext } from '@/components/appContext';
import { schemaSQLViewOf } from '@/components/schema-sql/schemaSQLView';
import { Database } from '@/constants/schema';
import { menuLabel } from '@/i18n/menuLabel';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import {
  resolveSchemaSQLOptions,
  SchemaSQLHeader,
  schemaSQLSupport,
} from '@/utils/schema-sql';
import type { SchemaSQLSupport } from '@/utils/schema-sql/options';

import { databaseLabel } from './statementsMenus';

type Menu = {
  id: SchemaSQLHeader;
  name: string;
  labelKey?: PlainMessageKey;
};

/** No header, then the two as the SQL they write names them, which no language translates. */
export const menus: ReadonlyArray<Menu> = [
  { id: SchemaSQLHeader.none, name: 'None', labelKey: 'common.none' },
  { id: SchemaSQLHeader.use, name: 'USE' },
  { id: SchemaSQLHeader.createAndUse, name: 'CREATE + USE' },
];

/** Whether a database writes the header; every one can write none. */
export const isHeaderSupported = (
  { headers }: SchemaSQLSupport,
  id: SchemaSQLHeader
) => id === SchemaSQLHeader.none || headers.some(header => header === id);

type HeaderHints = Partial<Record<Exclude<SchemaSQLHeader, 'none'>, string>>;

const DATABASE_HINTS: HeaderHints = {
  use: 'USE',
  createAndUse: 'CREATE DATABASE + USE',
};

const SCHEMA_HINTS: HeaderHints = {
  use: 'USE SCHEMA',
  createAndUse: 'CREATE SCHEMA + USE SCHEMA',
};

/** The statements each header writes in a database, as SQL, which no language translates. */
const HEADER_HINTS: Record<number, HeaderHints> = {
  [Database.MySQL]: DATABASE_HINTS,
  [Database.MariaDB]: DATABASE_HINTS,
  [Database.MSSQL]: DATABASE_HINTS,
  [Database.PostgreSQL]: { createAndUse: 'CREATE SCHEMA + SET search_path' },
  [Database.Oracle]: { use: 'ALTER SESSION SET CURRENT_SCHEMA' },
  [Database.Snowflake]: SCHEMA_HINTS,
  [Database.Databricks]: SCHEMA_HINTS,
};

/** What a header writes in a database, or nothing for none or one it lacks. */
export const headerHint = (
  database: number,
  id: SchemaSQLHeader
): string | undefined =>
  id === SchemaSQLHeader.none ? undefined : HEADER_HINTS[database]?.[id];

/**
 * The Header rows of the Schema SQL menu, ruled as the Statements rows are:
 * None in the reader's language, the two headers as SQL.
 */
export function createHeaderMenus(
  app: Pick<AppContext, 'store'>,
  i18n: Pick<I18n, 't'>
) {
  const { settings } = app.store.state;
  const view = schemaSQLViewOf(app);
  const { header } = resolveSchemaSQLOptions(
    settings.database,
    view,
    settings.databaseName
  );
  const support = schemaSQLSupport(settings.database);
  const database = databaseLabel(settings.database);

  return menus.map(menu => {
    const supported = isHeaderSupported(support, menu.id);

    return {
      id: menu.id,
      name: menuLabel(i18n, menu),
      literal: !menu.labelKey,
      checked: menu.id === header,
      note: supported
        ? null
        : i18n.t('contextMenu.notInDatabase', { database }),
      onClick: supported
        ? () => {
            view.header = menu.id;
          }
        : undefined,
    };
  });
}
