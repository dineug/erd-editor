import { describe, expect, it } from 'vitest';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import {
  createTableNameCaseMenus,
  menus,
} from '@/components/generator-code/generator-code-context-menu/menus/tableNameCaseMenus';
import { Language, NameCase } from '@/constants/schema';
import {
  changeColumnNameCaseAction,
  changeLanguageAction,
} from '@/engine/modules/settings/atom.actions';

describe('tableNameCaseMenus', () => {
  it('exposes the four name cases in a stable order', () => {
    expect(menus).toEqual([
      { name: 'Pascal', value: NameCase.pascalCase },
      { name: 'Camel', value: NameCase.camelCase },
      { name: 'Snake', value: NameCase.snakeCase },
      { name: 'None', value: NameCase.none },
    ]);
  });

  it('mirrors the menu names and keeps one entry per name case', () => {
    const app = createTestAppContext();
    const created = createTableNameCaseMenus(app);

    expect(created).toHaveLength(menus.length);
    expect(created.map(menu => menu.name)).toEqual([
      'Pascal',
      'Camel',
      'Snake',
      'None',
    ]);
    created.forEach(menu => expect(typeof menu.onClick).toBe('function'));
  });

  it('checks exactly the entry matching the current tableNameCase setting', () => {
    const app = createTestAppContext();
    const created = createTableNameCaseMenus(app);

    expect(app.store.state.settings.tableNameCase).toBe(NameCase.pascalCase);
    expect(created.filter(menu => menu.checked)).toHaveLength(1);
    expect(created.find(menu => menu.checked)?.name).toBe('Pascal');
  });

  it('dispatches the table name case the clicked entry stands for', async () => {
    const app = createTestAppContext();
    const camel = createTableNameCaseMenus(app).find(
      menu => menu.name === 'Camel'
    );

    camel?.onClick();
    await flush();

    expect(app.store.state.settings.tableNameCase).toBe(NameCase.camelCase);
  });

  it('re-reads the settings on every call so the check follows the store', async () => {
    const app = createTestAppContext();

    createTableNameCaseMenus(app)
      .find(menu => menu.name === 'Snake')
      ?.onClick();
    await flush();

    const created = createTableNameCaseMenus(app);
    expect(created.find(menu => menu.checked)?.name).toBe('Snake');
    expect(created.filter(menu => menu.checked)).toHaveLength(1);
  });

  it('drives every entry through to its own name case value', async () => {
    const app = createTestAppContext();

    for (const menu of menus) {
      createTableNameCaseMenus(app)
        .find(created => created.name === menu.name)
        ?.onClick();
      await flush();

      expect(app.store.state.settings.tableNameCase).toBe(menu.value);
    }
  });

  it('leaves the column name case and language settings untouched', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      changeColumnNameCaseAction({ value: NameCase.snakeCase })
    );
    app.store.dispatchSync(changeLanguageAction({ value: Language.Kotlin }));

    createTableNameCaseMenus(app)
      .find(menu => menu.name === 'None')
      ?.onClick();
    await flush();

    expect(app.store.state.settings.tableNameCase).toBe(NameCase.none);
    expect(app.store.state.settings.columnNameCase).toBe(NameCase.snakeCase);
    expect(app.store.state.settings.language).toBe(Language.Kotlin);
  });
});
