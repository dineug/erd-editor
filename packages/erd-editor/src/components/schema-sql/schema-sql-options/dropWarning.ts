import { Database } from '@/constants/schema';
import type { I18n } from '@/i18n/translate';

/** How many tables the warning names before it counts the rest instead. */
const LISTED_TABLES = 5;

/**
 * What a drop and re-create takes with it, the tables named in the reader's
 * language, the first four and a count past five; Snowflake replaces them in
 * place. Null with no table to drop.
 */
export function formatDropWarning(
  i18n: Pick<I18n, 'locale' | 't'>,
  database: number,
  tables: ReadonlyArray<string>
): string | null {
  if (!tables.length) return null;

  const listed =
    tables.length <= LISTED_TABLES
      ? [...tables]
      : [
          ...tables.slice(0, LISTED_TABLES - 1),
          i18n.t('schemaSql.moreTables', {
            count: tables.length - (LISTED_TABLES - 1),
          }),
        ];
  const list = new Intl.ListFormat(i18n.locale, {
    type: 'conjunction',
  }).format(listed);

  return database === Database.Snowflake
    ? i18n.t('schemaSql.replaceWarning', { tables: list })
    : i18n.t('schemaSql.dropWarning', { tables: list });
}
