import { describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import {
  createColumnNameCaseMenus,
  menus,
} from '@/components/generator-code/generator-code-context-menu/menus/columnNameCaseMenus';
import { Language, NameCase } from '@/constants/schema';
import {
  changeLanguageAction,
  changeTableNameCaseAction,
} from '@/engine/modules/settings/atom.actions';

describe('columnNameCaseMenus', () => {
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
    const created = createColumnNameCaseMenus(app);

    expect(created).toHaveLength(menus.length);
    expect(created.map(menu => menu.name)).toEqual([
      'Pascal',
      'Camel',
      'Snake',
      'None',
    ]);
    created.forEach(menu => expect(typeof menu.onClick).toBe('function'));
  });

  it('checks exactly the entry matching the current columnNameCase setting', () => {
    const app = createTestAppContext();
    const created = createColumnNameCaseMenus(app);

    expect(app.store.state.settings.columnNameCase).toBe(NameCase.camelCase);
    expect(created.filter(menu => menu.checked)).toHaveLength(1);
    expect(created.find(menu => menu.checked)?.name).toBe('Camel');
  });

  it('dispatches the column name case the clicked entry stands for', async () => {
    const app = createTestAppContext();
    const snake = createColumnNameCaseMenus(app).find(
      menu => menu.name === 'Snake'
    );

    snake?.onClick();
    await flush();

    expect(app.store.state.settings.columnNameCase).toBe(NameCase.snakeCase);
  });

  it('re-reads the settings on every call so the check follows the store', async () => {
    const app = createTestAppContext();

    createColumnNameCaseMenus(app)
      .find(menu => menu.name === 'None')
      ?.onClick();
    await flush();

    const created = createColumnNameCaseMenus(app);
    expect(created.find(menu => menu.checked)?.name).toBe('None');
    expect(created.filter(menu => menu.checked)).toHaveLength(1);
  });

  it('drives every entry through to its own name case value', async () => {
    const app = createTestAppContext();

    for (const menu of menus) {
      createColumnNameCaseMenus(app)
        .find(created => created.name === menu.name)
        ?.onClick();
      await flush();

      expect(app.store.state.settings.columnNameCase).toBe(menu.value);
    }
  });

  it('leaves the table name case and language settings untouched', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      changeTableNameCaseAction({ value: NameCase.snakeCase })
    );
    app.store.dispatchSync(
      changeLanguageAction({ value: Language.TypeScript })
    );

    createColumnNameCaseMenus(app)
      .find(menu => menu.name === 'Pascal')
      ?.onClick();
    await flush();

    expect(app.store.state.settings.columnNameCase).toBe(NameCase.pascalCase);
    expect(app.store.state.settings.tableNameCase).toBe(NameCase.snakeCase);
    expect(app.store.state.settings.language).toBe(Language.TypeScript);
  });
});
