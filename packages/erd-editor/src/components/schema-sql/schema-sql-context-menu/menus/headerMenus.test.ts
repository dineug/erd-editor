import { afterEach, describe, expect, it } from 'vite-plus/test';

import { pseudoMessages } from '@/__test-utils__/i18n';
import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext, appDestroy } from '@/components/appContext';
import {
  createHeaderMenus,
  headerHint,
  isHeaderSupported,
  menus,
} from '@/components/schema-sql/schema-sql-context-menu/menus/headerMenus';
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

describe('headerMenus', () => {
  it('names None by its key and the two headers as the SQL they write', () => {
    expect(menus).toEqual([
      { id: 'none', name: 'None', labelKey: 'common.none' },
      { id: 'use', name: 'USE' },
      { id: 'createAndUse', name: 'CREATE + USE' },
    ]);
  });

  it('allows none everywhere and a header only where the database writes it', () => {
    const sqlite = schemaSQLSupport(Database.SQLite);
    const oracle = schemaSQLSupport(Database.Oracle);
    const postgres = schemaSQLSupport(Database.PostgreSQL);

    expect(isHeaderSupported(sqlite, 'none')).toBe(true);
    expect(isHeaderSupported(sqlite, 'use')).toBe(false);
    expect(isHeaderSupported(oracle, 'use')).toBe(true);
    expect(isHeaderSupported(oracle, 'createAndUse')).toBe(false);
    expect(isHeaderSupported(postgres, 'use')).toBe(false);
    expect(isHeaderSupported(postgres, 'createAndUse')).toBe(true);
  });

  it('hints at the statements each header writes, per database', () => {
    const hints = (database: number) => [
      headerHint(database, 'none'),
      headerHint(database, 'use'),
      headerHint(database, 'createAndUse'),
    ];

    for (const database of [Database.MySQL, Database.MariaDB, Database.MSSQL]) {
      expect(hints(database)).toEqual([
        undefined,
        'USE',
        'CREATE DATABASE + USE',
      ]);
    }
    expect(hints(Database.PostgreSQL)).toEqual([
      undefined,
      undefined,
      'CREATE SCHEMA + SET search_path',
    ]);
    expect(hints(Database.Oracle)).toEqual([
      undefined,
      'ALTER SESSION SET CURRENT_SCHEMA',
      undefined,
    ]);
    for (const database of [Database.Snowflake, Database.Databricks]) {
      expect(hints(database)).toEqual([
        undefined,
        'USE SCHEMA',
        'CREATE SCHEMA + USE SCHEMA',
      ]);
    }
    expect(hints(Database.SQLite)).toEqual([undefined, undefined, undefined]);
  });

  it("checks the header the database writes for the window's pick, noting the rest", () => {
    const created = createHeaderMenus(createApp(Database.Oracle), sourceI18n);

    expect(
      created.map(menu => [menu.id, menu.name, menu.checked, menu.note])
    ).toEqual([
      ['none', 'None', false, null],
      ['use', 'USE', true, null],
      ['createAndUse', 'CREATE + USE', false, 'not in Oracle'],
    ]);
    expect(created.map(menu => menu.literal)).toEqual([false, true, true]);
    expect(created[2].onClick).toBeUndefined();
  });

  it("reads None in the reader's language", () => {
    const created = createHeaderMenus(
      createApp(Database.SQLite),
      createI18n('ko-KR', pseudoMessages('ko'))
    );

    expect(created.map(menu => [menu.name, menu.note])).toEqual([
      ['ko:None', null],
      ['USE', 'ko:not in SQLite'],
      ['CREATE + USE', 'ko:not in SQLite'],
    ]);
  });

  it('keeps a pick in the window', () => {
    const current = createApp();

    createHeaderMenus(current, sourceI18n)[1].onClick?.();

    expect(schemaSQLViewOf(current).header).toBe('use');
  });
});
