import { afterEach, describe, expect, it } from 'vite-plus/test';

import { pseudoMessages } from '@/__test-utils__/i18n';
import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext, appDestroy } from '@/components/appContext';
import {
  createStatementsMenus,
  databaseLabel,
  isStatementsSupported,
  menus,
} from '@/components/schema-sql/schema-sql-context-menu/menus/statementsMenus';
import { schemaSQLViewOf } from '@/components/schema-sql/schemaSQLView';
import { Database } from '@/constants/schema';
import { changeDatabaseAction } from '@/engine/modules/settings/atom.actions';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';
import { schemaSQLSupport } from '@/utils/schema-sql';

let app: AppContext | null = null;

const createApp = (database: number = Database.MySQL) => {
  app = createTestAppContext();
  app.store.dispatchSync(changeDatabaseAction({ value: database }));
  return app;
};

afterEach(() => {
  app && appDestroy(app);
  app = null;
});

describe('statementsMenus', () => {
  it("names the three statements as written, in the panel's order", () => {
    expect(menus.map(({ id, name }) => [id, name])).toEqual([
      ['create', 'Create'],
      ['ifNotExists', 'If not exists'],
      ['recreate', 'Drop & re-create'],
    ]);
  });

  it('holds if not exists to the databases that check first, the other two to every one', () => {
    const checking: number[] = [
      Database.MySQL,
      Database.MariaDB,
      Database.PostgreSQL,
      Database.SQLite,
      Database.Databricks,
    ];

    for (const database of Object.values(Database)) {
      const support = schemaSQLSupport(database);
      expect(isStatementsSupported(support, 'create')).toBe(true);
      expect(isStatementsSupported(support, 'recreate')).toBe(true);
      expect(
        isStatementsSupported(support, 'ifNotExists'),
        String(database)
      ).toBe(checking.includes(database));
    }
  });

  it('names a database as its menu does, and nothing for a value no menu lists', () => {
    expect(databaseLabel(Database.MSSQL)).toBe('MSSQL');
    expect(databaseLabel(Database.SQLite)).toBe('SQLite');
    expect(databaseLabel(3)).toBe('');
  });

  it("checks what the database writes for the window's pick", () => {
    const created = createStatementsMenus(
      createApp(Database.Snowflake),
      sourceI18n
    );

    expect(created.map(menu => [menu.id, menu.checked, menu.note])).toEqual([
      ['create', true, null],
      ['ifNotExists', false, 'not in Snowflake'],
      ['recreate', false, null],
    ]);
    expect(created[1].onClick).toBeUndefined();
  });

  it("notes the database in the reader's language", () => {
    const created = createStatementsMenus(
      createApp(Database.Oracle),
      createI18n('ko-KR', pseudoMessages('ko'))
    );

    expect(created[1].note).toBe('ko:not in Oracle');
    expect(created[1].name).toBe('If not exists');
  });

  it('keeps a pick in the window, which changes no setting', () => {
    const current = createApp();
    const created = createStatementsMenus(current, sourceI18n);

    created[2].onClick?.();

    expect(schemaSQLViewOf(current).statements).toBe('recreate');
    expect(current.store.state.settings.database).toBe(Database.MySQL);
  });
});
