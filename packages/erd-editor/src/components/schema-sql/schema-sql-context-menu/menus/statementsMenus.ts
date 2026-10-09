import type { AppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { schemaSQLViewOf } from '@/components/schema-sql/schemaSQLView';
import type { I18n } from '@/i18n/translate';
import {
  resolveSchemaSQLOptions,
  SchemaSQLStatements,
  schemaSQLSupport,
} from '@/utils/schema-sql';
import type { SchemaSQLSupport } from '@/utils/schema-sql/options';

type Menu = {
  id: SchemaSQLStatements;
  name: string;
};

/** The three ways the tables are written, named alike in every language, as the owner decided. */
export const menus: ReadonlyArray<Menu> = [
  { id: SchemaSQLStatements.create, name: 'Create' },
  { id: SchemaSQLStatements.ifNotExists, name: 'If not exists' },
  { id: SchemaSQLStatements.recreate, name: 'Drop & re-create' },
];

/** Whether a database writes the statements: every one drops and re-creates, not every one checks first. */
export const isStatementsSupported = (
  { ifNotExists }: SchemaSQLSupport,
  id: SchemaSQLStatements
) => id !== SchemaSQLStatements.ifNotExists || ifNotExists;

/** A database by the name its menu gives it, or nothing for a value no menu lists. */
export const databaseLabel = (database: number): string =>
  databaseMenus.find(menu => menu.value === database)?.name ?? '';

/**
 * The Statements rows of the Schema SQL menu: the one the database writes
 * checked, one it lacks noted and inert, a pick kept for this window alone.
 */
export function createStatementsMenus(
  app: Pick<AppContext, 'store'>,
  i18n: Pick<I18n, 't'>
) {
  const { settings } = app.store.state;
  const view = schemaSQLViewOf(app);
  const { statements } = resolveSchemaSQLOptions(
    settings.database,
    view,
    settings.databaseName
  );
  const support = schemaSQLSupport(settings.database);
  const database = databaseLabel(settings.database);

  return menus.map(menu => {
    const supported = isStatementsSupported(support, menu.id);

    return {
      id: menu.id,
      name: menu.name,
      checked: menu.id === statements,
      note: supported
        ? null
        : i18n.t('contextMenu.notInDatabase', { database }),
      onClick: supported
        ? () => {
            view.statements = menu.id;
          }
        : undefined,
    };
  });
}
