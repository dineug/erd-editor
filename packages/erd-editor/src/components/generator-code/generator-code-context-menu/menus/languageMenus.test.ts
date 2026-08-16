import { describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import {
  createLanguageMenus,
  menus,
} from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import { Language, NameCase } from '@/constants/schema';
import { changeTableNameCaseAction } from '@/engine/modules/settings/atom.actions';

describe('languageMenus', () => {
  it('exposes every supported generator language in a stable order', () => {
    expect(menus).toEqual([
      { name: 'GraphQL', value: Language.GraphQL },
      { name: 'C#', value: Language.csharp },
      { name: 'Java', value: Language.Java },
      { name: 'Kotlin', value: Language.Kotlin },
      { name: 'TypeScript', value: Language.TypeScript },
      { name: 'JPA', value: Language.JPA },
      { name: 'Scala', value: Language.Scala },
    ]);
  });

  it('mirrors the menu names and keeps one entry per language', () => {
    const app = createTestAppContext();
    const created = createLanguageMenus(app);

    expect(created).toHaveLength(menus.length);
    expect(created.map(menu => menu.name)).toEqual([
      'GraphQL',
      'C#',
      'Java',
      'Kotlin',
      'TypeScript',
      'JPA',
      'Scala',
    ]);
    created.forEach(menu => expect(typeof menu.onClick).toBe('function'));
  });

  it('checks exactly the entry matching the current language setting', () => {
    const app = createTestAppContext();
    const created = createLanguageMenus(app);

    expect(app.store.state.settings.language).toBe(Language.GraphQL);
    expect(created.filter(menu => menu.checked)).toHaveLength(1);
    expect(created.find(menu => menu.checked)?.name).toBe('GraphQL');
  });

  it('dispatches the language the clicked entry stands for', async () => {
    const app = createTestAppContext();
    const typescript = createLanguageMenus(app).find(
      menu => menu.name === 'TypeScript'
    );

    typescript?.onClick();
    await flush();

    expect(app.store.state.settings.language).toBe(Language.TypeScript);
  });

  it('re-reads the settings on every call so the check follows the store', async () => {
    const app = createTestAppContext();

    createLanguageMenus(app)
      .find(menu => menu.name === 'Scala')
      ?.onClick();
    await flush();

    const created = createLanguageMenus(app);
    expect(created.find(menu => menu.checked)?.name).toBe('Scala');
    expect(created.filter(menu => menu.checked)).toHaveLength(1);
  });

  it('drives every entry through to its own language value', async () => {
    const app = createTestAppContext();

    for (const menu of menus) {
      createLanguageMenus(app)
        .find(created => created.name === menu.name)
        ?.onClick();
      await flush();

      expect(app.store.state.settings.language).toBe(menu.value);
    }
  });

  it('replaces the language instead of accumulating bit flags', async () => {
    const app = createTestAppContext();
    const created = createLanguageMenus(app);

    created.find(menu => menu.name === 'Java')?.onClick();
    await flush();
    created.find(menu => menu.name === 'JPA')?.onClick();
    await flush();

    expect(app.store.state.settings.language).toBe(Language.JPA);
  });

  it('leaves the name case settings untouched', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      changeTableNameCaseAction({ value: NameCase.snakeCase })
    );

    createLanguageMenus(app)
      .find(menu => menu.name === 'C#')
      ?.onClick();
    await flush();

    expect(app.store.state.settings.language).toBe(Language.csharp);
    expect(app.store.state.settings.tableNameCase).toBe(NameCase.snakeCase);
    expect(app.store.state.settings.columnNameCase).toBe(NameCase.camelCase);
  });
});
