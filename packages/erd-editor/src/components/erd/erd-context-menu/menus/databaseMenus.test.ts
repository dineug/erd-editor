import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  createDatabaseMenus,
  menus,
} from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { Database } from '@/constants/schema';
import { changeDatabaseAction } from '@/engine/modules/settings/atom.actions';

let app: AppContext;

beforeEach(() => {
  app = createTestAppContext();
});

describe('databaseMenus', () => {
  it('exposes one menu per supported database vendor', () => {
    expect(menus.map(menu => menu.name)).toEqual([
      'Databricks',
      'MSSQL',
      'MariaDB',
      'MySQL',
      'Oracle',
      'PostgreSQL',
      'SQLite',
    ]);
    expect(menus.map(menu => menu.value)).toEqual([
      Database.Databricks,
      Database.MSSQL,
      Database.MariaDB,
      Database.MySQL,
      Database.Oracle,
      Database.PostgreSQL,
      Database.SQLite,
    ]);
  });

  it('marks only the current database as checked', () => {
    app.store.dispatchSync(changeDatabaseAction({ value: Database.Oracle }));

    const result = createDatabaseMenus(app);

    expect(result).toHaveLength(menus.length);
    expect(result.filter(menu => menu.checked).map(menu => menu.name)).toEqual([
      'Oracle',
    ]);
  });

  it('moves the checked flag when the database changes', () => {
    app.store.dispatchSync(changeDatabaseAction({ value: Database.SQLite }));
    expect(
      createDatabaseMenus(app).find(menu => menu.name === 'SQLite')?.checked
    ).toBe(true);

    app.store.dispatchSync(changeDatabaseAction({ value: Database.MariaDB }));
    const result = createDatabaseMenus(app);
    expect(result.find(menu => menu.name === 'SQLite')?.checked).toBe(false);
    expect(result.find(menu => menu.name === 'MariaDB')?.checked).toBe(true);
  });

  it('dispatches changeDatabaseAction on click', async () => {
    app.store.dispatchSync(changeDatabaseAction({ value: Database.MySQL }));

    const postgres = createDatabaseMenus(app).find(
      menu => menu.name === 'PostgreSQL'
    );
    postgres?.onClick();
    await flush();

    expect(app.store.state.settings.database).toBe(Database.PostgreSQL);
  });

  it('dispatches for every vendor entry', async () => {
    for (const menu of menus) {
      const target = createDatabaseMenus(app).find(
        item => item.name === menu.name
      );
      target?.onClick();
      await flush();
      expect(app.store.state.settings.database).toBe(menu.value);
    }
  });
});
