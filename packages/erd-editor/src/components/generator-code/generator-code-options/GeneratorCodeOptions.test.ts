import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import {
  menuGroups as languageMenuGroups,
  menus as languageMenus,
} from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import GeneratorCodeOptions, {
  GENERATOR_CODE_OPTIONS_ID,
} from '@/components/generator-code/generator-code-options/GeneratorCodeOptions';
import {
  BracketType,
  Database,
  Language,
  LockSettingType,
  NameCase,
} from '@/constants/schema';
import {
  changeDatabaseAction,
  changeLanguageAction,
} from '@/engine/modules/settings/atom.actions';
import { createI18n } from '@/i18n/translate';
import { bHas } from '@/utils/bit';

let mounted: Mounted | null = null;
const apps: AppContext[] = [];

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  apps.splice(0).forEach(app => app.store.destroy());
});

function createApp(language: number = Language.TypeScript): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(
    changeLanguageAction({ value: language }),
    changeDatabaseAction({ value: Database.PostgreSQL })
  );
  apps.push(app);
  return app;
}

type Handlers = {
  onHide?: () => void;
  onSave?: () => void;
  onCopy?: () => void;
};

async function mountPanel(app: AppContext, handlers: Handlers = {}) {
  mounted = await mountAndFlush(
    html`<${GeneratorCodeOptions}
      isDarkMode=${true}
      .onHide=${handlers.onHide ?? (() => {})}
      .onSave=${handlers.onSave ?? (() => {})}
      .onCopy=${handlers.onCopy ?? (() => {})}
    />`,
    app
  );
  return mounted;
}

const panelOf = () =>
  (mounted as Mounted).container.querySelector('aside') as HTMLElement;

const query = <T extends Element = HTMLElement>(selector: string) =>
  (mounted as Mounted).container.querySelector<T>(selector);

const selectOf = (id: string) =>
  query<HTMLSelectElement>(`#generator-code-${id}`)!;

const settingsOf = () =>
  Array.from(
    panelOf().querySelectorAll<HTMLElement>('.generator-code-options-setting')
  );

/** Each row's label, and whether it is dimmed. */
const rowsOf = () =>
  settingsOf().map(row => ({
    label: row.querySelector('label')?.textContent,
    unused: row.dataset.unused === 'true',
  }));

const notesOf = () =>
  Array.from(
    panelOf().querySelectorAll('.generator-code-options-unused'),
    note => note.textContent
  );

const optionsOf = (select: HTMLSelectElement) =>
  Array.from(select.options, option => option.textContent);

/** Picks a value in a native list, as the reader does. */
function pick(select: HTMLSelectElement, value: number) {
  select.value = String(value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('GeneratorCodeOptions', () => {
  it('heads the panel with Code Generator and a Hide options button that controls it', async () => {
    const onHide = vi.fn();
    await mountPanel(createApp(), { onHide });

    const panel = panelOf();
    const hide = query<HTMLButtonElement>('.generator-code-options-hide')!;
    expect(panel.id).toBe(GENERATOR_CODE_OPTIONS_ID);
    expect(
      panel.querySelector(`#${panel.getAttribute('aria-labelledby')}`)
        ?.textContent
    ).toBe('Code Generator');
    expect(hide.getAttribute('aria-label')).toBe('Hide options');
    expect(hide.getAttribute('title')).toBe('Hide options');
    expect(hide.getAttribute('aria-expanded')).toBe('true');
    expect(hide.getAttribute('aria-controls')).toBe(GENERATOR_CODE_OPTIONS_ID);

    hide.click();
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('lists the four settings the document saves, each labelled, with no Bracket for TypeScript', async () => {
    await mountPanel(createApp());

    const group = panelOf().querySelector('section[role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('Saved in the document');
    expect(rowsOf().map(row => row.label)).toEqual([
      'Language',
      'Database',
      'Table Name Case',
      'Column Name Case',
    ]);
    for (const row of settingsOf()) {
      const label = row.querySelector('label')!;
      expect(row.querySelector('select')?.id).toBe(label.htmlFor);
    }
  });

  it('lists every language in the menu order, a rule between the groups and nothing else', async () => {
    await mountPanel(createApp());
    const language = selectOf('language');

    expect(optionsOf(language)).toEqual(languageMenus.map(menu => menu.name));
    expect(
      Array.from(language.children, child =>
        child.tagName === 'HR' ? '—' : child.textContent
      )
    ).toEqual(
      languageMenuGroups.flatMap((group, index) => [
        ...(index ? ['—'] : []),
        ...group.map(menu => menu.name),
      ])
    );
    expect(language.querySelectorAll('optgroup')).toHaveLength(0);
    expect(language.value).toBe(String(Language.TypeScript));
  });

  it('ends each language with a left-to-right mark in a right-to-left language, and nothing else', async () => {
    const app = createApp(Language.csharp);
    const provider = provideI18n(document.body, createTestI18n('ar-SA'));

    try {
      await mountPanel(app);

      expect(optionsOf(selectOf('language'))).toEqual(
        languageMenus.map(menu => `${menu.name}\u200e`)
      );
      expect(optionsOf(selectOf('database'))).toEqual(
        databaseMenus.map(menu => menu.name)
      );
      expect(optionsOf(selectOf('table-name-case'))[0]).toBe('Pascal');
    } finally {
      provider.destroy();
    }
  });

  it('picks the language, the database and both name cases with the actions the menus send', async () => {
    const app = createApp();
    await mountPanel(app);

    expect(optionsOf(selectOf('database'))).toEqual(
      databaseMenus.map(menu => menu.name)
    );
    expect(selectOf('database').value).toBe(String(Database.PostgreSQL));
    expect(optionsOf(selectOf('table-name-case'))).toEqual([
      'Pascal',
      'Camel',
      'Snake',
      'None',
    ]);

    pick(selectOf('language'), Language.Kotlin);
    pick(selectOf('database'), Database.Oracle);
    pick(selectOf('table-name-case'), NameCase.snakeCase);
    pick(selectOf('column-name-case'), NameCase.none);
    await flush();

    const { settings } = app.store.state;
    expect(settings.language).toBe(Language.Kotlin);
    expect(settings.database).toBe(Database.Oracle);
    expect(settings.tableNameCase).toBe(NameCase.snakeCase);
    expect(settings.columnNameCase).toBe(NameCase.none);
    expect(selectOf('language').value).toBe(String(Language.Kotlin));
  });

  it.each([
    { name: 'Doctrine', language: Language.Doctrine },
    { name: 'JPA', language: Language.JPA },
    { name: 'SeaORM', language: Language.SeaORM },
  ])(
    'adds Bracket for $name, which reads it, and picks it',
    async ({ language }) => {
      const app = createApp(language);
      await mountPanel(app);

      expect(rowsOf().map(row => row.label)).toContain('Bracket');
      expect(optionsOf(selectOf('bracket'))).toEqual([
        'SingleQuote',
        'DoubleQuote',
        'Backtick',
        'None',
      ]);

      pick(selectOf('bracket'), BracketType.backtick);
      await flush();

      expect(app.store.state.settings.bracketType).toBe(BracketType.backtick);
    }
  );

  it('takes Bracket away once the language reads it no more', async () => {
    const app = createApp(Language.Doctrine);
    await mountPanel(app);

    pick(selectOf('language'), Language.PHP);
    await flush();

    expect(query('#generator-code-bracket')).toBeNull();
  });

  it('dims each setting the language ignores, under one note naming the language', async () => {
    const app = createApp(Language.Mermaid);
    await mountPanel(app);

    expect(rowsOf().map(row => [row.label, row.unused])).toEqual([
      ['Language', false],
      ['Database', true],
      ['Table Name Case', true],
      ['Column Name Case', true],
    ]);
    expect(notesOf()).toEqual(['Not used by Mermaid', 'Not used by Mermaid']);
    expect(selectOf('database').getAttribute('aria-describedby')).toBe(
      'generator-code-database-unused'
    );
    expect(
      selectOf('column-name-case').getAttribute('aria-describedby')
    ).toContain('generator-code-name-cases-unused');

    pick(selectOf('language'), Language.SeaORM);
    await flush();

    expect(rowsOf().map(row => [row.label, row.unused])).toEqual([
      ['Language', false],
      ['Database', false],
      ['Table Name Case', true],
      ['Column Name Case', true],
      ['Bracket', false],
    ]);
    expect(notesOf()).toEqual(['Not used by SeaORM']);

    pick(selectOf('language'), Language.Swift);
    await flush();

    expect(rowsOf().some(row => row.unused)).toBe(false);
    expect(notesOf()).toEqual([]);
  });

  it('still takes a pick on a dimmed setting, which Schema SQL reads', async () => {
    const app = createApp(Language.DBML);
    await mountPanel(app);

    pick(selectOf('database'), Database.SQLite);
    await flush();

    expect(app.store.state.settings.database).toBe(Database.SQLite);
  });

  it('shows no lock on the settings Settings locks, as a new document locks them all, leaving that to the Settings tab', async () => {
    const app = createApp(Language.Doctrine);
    const locks = [
      LockSettingType.language,
      LockSettingType.tableNameCase,
      LockSettingType.columnNameCase,
      LockSettingType.bracketType,
    ];
    expect(
      locks.every(lock => bHas(app.store.state.settings.lockSettings, lock))
    ).toBe(true);
    await mountPanel(app);

    expect(rowsOf().map(row => row.label)).toEqual([
      'Language',
      'Database',
      'Table Name Case',
      'Column Name Case',
      'Bracket',
    ]);
    for (const row of settingsOf()) {
      expect(row.querySelector('svg')).toBeNull();
      expect(
        row.querySelector('[title], [aria-label], [role="img"]')
      ).toBeNull();
      expect(
        row.querySelector('select')?.getAttribute('aria-describedby')
      ).toBe('');
    }
    expect(panelOf().querySelector('[id*="lock"], [class*="lock"]')).toBeNull();
    expect(panelOf().textContent).not.toContain('Locked');
  });

  it('changes a locked setting on screen while the file keeps the locked value', async () => {
    const app = createApp();
    await mountPanel(app);
    const locked = app.store.state.settings.lockedValues.language;
    expect(locked).toBe(Language.GraphQL);

    pick(selectOf('language'), Language.Go);
    await flush();

    expect(app.store.state.settings.language).toBe(Language.Go);
    expect(app.store.state.settings.lockedValues.language).toBe(locked);
  });

  it("names its settings, notes and buttons in the reader's language, the languages and vendors as written", async () => {
    const app = createApp(Language.SeaORM);
    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);

    try {
      await mountPanel(app);
      Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
      await flush();

      expect(rowsOf().map(row => row.label)).toEqual([
        'ko:Language',
        'ko:Database',
        'ko:Table Name Case',
        'ko:Column Name Case',
        'ko:Bracket',
      ]);
      expect(notesOf()).toEqual(['ko:Not used by SeaORM']);
      expect(optionsOf(selectOf('table-name-case')).at(-1)).toBe('ko:None');
      expect(optionsOf(selectOf('language'))).toContain('SeaORM');
      expect(optionsOf(selectOf('database'))).toContain('PostgreSQL');
      expect(query('.generator-code-options-save')?.textContent?.trim()).toBe(
        'ko:Save file'
      );
      expect(panelOf().getAttribute('aria-labelledby')).toBeTruthy();
      expect(
        panelOf().querySelector('section')?.getAttribute('aria-label')
      ).toBe('ko:Saved in the document');
    } finally {
      provider.destroy();
    }
  });

  it('saves and copies from its two buttons', async () => {
    const onSave = vi.fn();
    const onCopy = vi.fn();
    await mountPanel(createApp(), { onSave, onCopy });

    const save = query<HTMLButtonElement>('.generator-code-options-save')!;
    const copy = query<HTMLButtonElement>('.generator-code-options-copy')!;
    expect(save.textContent?.trim()).toBe('Save file');
    expect(save.querySelector('svg')).not.toBeNull();
    expect(copy.textContent?.trim()).toBe('Copy');

    save.click();
    copy.click();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('keeps Space inside the panel from the hand tool, unprevented', async () => {
    await mountPanel(createApp());
    const behind = vi.fn();
    (mounted as Mounted).container.addEventListener('keydown', behind);

    const space = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    selectOf('language').dispatchEvent(space);

    expect(space.defaultPrevented).toBe(false);
    expect(behind).not.toHaveBeenCalled();
  });

  it("gives the native lists the panel's colour scheme", async () => {
    await mountPanel(createApp());

    expect(panelOf().style.getPropertyValue('color-scheme')).toBe('dark');
  });
});
