import { FC, html } from '@dineug/r-html';
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
import GeneratorCodeContextMenu from '@/components/generator-code/generator-code-context-menu/GeneratorCodeContextMenu';
import { generatorCodeViewOf } from '@/components/generator-code/generatorCodeView';
import * as itemStyles from '@/components/primitives/context-menu/context-menu-item/ContextMenuItem.styles';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { BracketType, Database, Language, NameCase } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { changeLanguageAction } from '@/engine/modules/settings/atom.actions';
import { createI18n } from '@/i18n/translate';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

type Api = ReturnType<typeof useContextMenuRootProvider>;
type HostProps = {
  full?: boolean;
  onSave?: () => void;
  onClose: () => void;
};

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function createHost() {
  let api: Api | null = null;

  const Host: FC<HostProps> = (props, ctx) => {
    api = useContextMenuRootProvider(ctx);

    return () => html`
      <${GeneratorCodeContextMenu}
        .full=${props.full}
        .onSave=${props.onSave}
        .onClose=${props.onClose}
      />
    `;
  };

  return { Host, getApi: () => api as Api };
}

const contentsOf = (m: Mounted) =>
  Array.from(
    m.container.querySelectorAll<HTMLElement>('.context-menu-content')
  );

const rowsOf = (el: HTMLElement) =>
  Array.from(
    el.querySelectorAll<HTMLElement>(`:scope > .${String(itemStyles.item)}`)
  );

const namesOf = (el: HTMLElement) =>
  rowsOf(el).map(row => row.textContent?.trim());

const checkedNameOf = (el: HTMLElement) =>
  rowsOf(el)
    .filter(row => row.querySelector('.icon'))
    .map(row => row.textContent?.trim());

type MenuOptions = {
  /** The whole document's tab, as the tab mounts it. */
  full?: boolean;
  onSave?: () => void;
  language?: number;
};

async function openMenu(
  onClose: () => void = () => {},
  {
    full = false,
    onSave = () => {},
    language = Language.GraphQL,
  }: MenuOptions = {}
) {
  const { Host, getApi } = createHost();
  const app = createTestAppContext();
  app.store.dispatchSync(
    changeLanguageAction({ value: language }),
    changeViewportAction({ width: 1280, height: 800 })
  );
  mounted = await mountAndFlush(
    html`<${Host} .full=${full} .onSave=${onSave} .onClose=${onClose} />`,
    app
  );

  getApi().state.show = true;
  await flush();

  return { app, getApi };
}

async function openSubmenu(name: string) {
  const [root] = contentsOf(mounted as Mounted);
  const row = rowsOf(root).find(item =>
    item.textContent?.includes(name)
  ) as HTMLElement;
  expect(row).toBeTruthy();

  row.dispatchEvent(new MouseEvent('mouseenter'));
  await flush();

  const submenu = contentsOf(mounted as Mounted).find(
    content => content.dataset.id === row.dataset.id
  ) as HTMLElement;
  expect(submenu).toBeTruthy();

  return submenu;
}

describe('GeneratorCodeContextMenu', () => {
  it('renders nothing while the context menu root is closed', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(html`<${Host} .onClose=${() => {}} />`);

    expect(contentsOf(mounted)).toHaveLength(0);
  });

  it('renders the four settings GraphQL follows once the root opens', async () => {
    await openMenu();

    const [root] = contentsOf(mounted as Mounted);
    expect(root.dataset.id).toBe('root');
    expect(namesOf(root)).toEqual([
      'Language',
      'Database',
      'Table Name Case',
      'Column Name Case',
    ]);
  });

  it.each([
    { name: 'Doctrine', language: Language.Doctrine },
    { name: 'JPA', language: Language.JPA },
    { name: 'SeaORM', language: Language.SeaORM },
  ])('adds Bracket for $name, which reads it', async ({ language }) => {
    const { app } = await openMenu(() => {}, { language });

    const [root] = contentsOf(mounted as Mounted);
    expect(namesOf(root)).toEqual([
      'Language',
      'Database',
      'Table Name Case',
      'Column Name Case',
      'Bracket',
    ]);

    const submenu = await openSubmenu('Bracket');
    expect(namesOf(submenu)).toEqual([
      'SingleQuote',
      'DoubleQuote',
      'Backtick',
      'None',
    ]);
    expect(checkedNameOf(submenu)).toHaveLength(1);

    const backtick = rowsOf(submenu).find(row =>
      row.textContent?.includes('Backtick')
    ) as HTMLElement;
    backtick.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(app.store.state.settings.bracketType).toBe(BracketType.backtick);
  });

  it('opens the database submenu with every vendor as written, the active one checked', async () => {
    const { app } = await openMenu();

    const submenu = await openSubmenu('Database');
    expect(namesOf(submenu)).toEqual([
      'Databricks',
      'MSSQL',
      'MariaDB',
      'MySQL',
      'Oracle',
      'PostgreSQL',
      'Snowflake',
      'SQLite',
    ]);
    expect(checkedNameOf(submenu)).toHaveLength(1);
    expect(rowsOf(submenu).every(row => row.querySelector('[dir="ltr"]'))).toBe(
      true
    );

    const oracle = rowsOf(submenu).find(row =>
      row.textContent?.includes('Oracle')
    ) as HTMLElement;
    oracle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(app.store.state.settings.database).toBe(Database.Oracle);
  });

  it('adds Options panel and Save file on the whole document, the panel checked while it shows', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const { app } = await openMenu(onClose, { full: true, onSave });

    const [root] = contentsOf(mounted as Mounted);
    expect(namesOf(root)).toEqual([
      'Language',
      'Database',
      'Table Name Case',
      'Column Name Case',
      'Options panel',
      'Save file…',
    ]);
    expect(generatorCodeViewOf(app).panel).toBe('open');

    const row = (name: string) =>
      rowsOf(root).find(item => item.textContent?.trim() === name)!;
    expect(row('Options panel').querySelector('svg')).not.toBeNull();

    row('Options panel').click();
    expect(generatorCodeViewOf(app).panel).toBe('closed');
    expect(onClose).toHaveBeenCalledTimes(1);
    await flush();
    expect(row('Options panel').querySelector('svg')).toBeNull();

    row('Save file…').click();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("leaves the panel's place unsettled on one table's menu", async () => {
    const { app } = await openMenu();

    const [root] = contentsOf(mounted as Mounted);
    expect(namesOf(root)).not.toContain('Options panel');
    expect(generatorCodeViewOf(app).panel).toBe('unset');
  });

  it('names its entries and None in the language the element shows, the rest as written', async () => {
    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);

    try {
      await openMenu();
      Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
      await flush();

      const [root] = contentsOf(mounted as Mounted);
      expect(namesOf(root)).toEqual([
        'ko:Language',
        'ko:Database',
        'ko:Table Name Case',
        'ko:Column Name Case',
      ]);
      expect(namesOf(await openSubmenu('ko:Table Name Case'))).toEqual([
        'Pascal',
        'Camel',
        'Snake',
        'ko:None',
      ]);
      expect(namesOf(await openSubmenu('ko:Column Name Case'))).toEqual([
        'Pascal',
        'Camel',
        'Snake',
        'ko:None',
      ]);
      const languages = await openSubmenu('ko:Language');
      expect(namesOf(languages)).toContain('TypeScript');
      expect(namesOf(languages)).toContain('JSON Schema');

      const rules = languages.querySelectorAll(':scope > [role="separator"]');
      expect(rules).toHaveLength(2);
      rules.forEach(rule => expect(rule.textContent).toBe(''));
    } finally {
      provider.destroy();
    }
  });

  it('gives each entry a leading icon and a trailing chevron', async () => {
    await openMenu();

    const [root] = contentsOf(mounted as Mounted);
    rowsOf(root).forEach(row => {
      expect(row.querySelectorAll('.icon')).toHaveLength(2);
      expect(row.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('opens the language submenu on hover with the active language checked', async () => {
    await openMenu();

    const submenu = await openSubmenu('Language');

    expect(namesOf(submenu)).toEqual([
      'C#',
      'Go',
      'Java',
      'Kotlin',
      'PHP',
      'Rust',
      'Scala',
      'Swift',
      'TypeScript',
      'Doctrine',
      'Drizzle',
      'JPA',
      'SeaORM',
      'Sequelize',
      'SQLAlchemy',
      'TypeORM',
      'AML',
      'DBML',
      'GraphQL',
      'JSON Schema',
      'Mermaid',
      'Zod',
    ]);
    expect(checkedNameOf(submenu)).toEqual(['GraphQL']);
  });

  it('rules the languages, the ORMs and the schemas apart', async () => {
    await openMenu();

    const submenu = await openSubmenu('Language');
    const children = Array.from(submenu.children, child =>
      child.getAttribute('role') === 'separator'
        ? '—'
        : child.textContent?.trim()
    );

    expect(children).toEqual([
      'C#',
      'Go',
      'Java',
      'Kotlin',
      'PHP',
      'Rust',
      'Scala',
      'Swift',
      'TypeScript',
      '—',
      'Doctrine',
      'Drizzle',
      'JPA',
      'SeaORM',
      'Sequelize',
      'SQLAlchemy',
      'TypeORM',
      '—',
      'AML',
      'DBML',
      'GraphQL',
      'JSON Schema',
      'Mermaid',
      'Zod',
    ]);
  });

  it('keeps each language name left to right, so C# reads as C# in a right-to-left menu', async () => {
    await openMenu();

    const submenu = await openSubmenu('Language');
    const names = rowsOf(submenu).map(row =>
      Array.from(row.querySelectorAll('[dir="ltr"]'), el => el.textContent)
    );

    expect(names[0]).toEqual(['C#']);
    expect(names.every(found => found.length === 1)).toBe(true);
  });

  it('changes the language and moves the check when a language row is clicked', async () => {
    const { app } = await openMenu();

    const submenu = await openSubmenu('Language');
    const kotlin = rowsOf(submenu).find(row =>
      row.textContent?.includes('Kotlin')
    ) as HTMLElement;

    kotlin.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(app.store.state.settings.language).toBe(Language.Kotlin);

    const reopened = contentsOf(mounted as Mounted).find(
      content => content.dataset.id !== 'root'
    ) as HTMLElement;
    expect(checkedNameOf(reopened)).toEqual(['Kotlin']);
  });

  it('opens the table name case submenu with the active case checked', async () => {
    const { app } = await openMenu();

    const submenu = await openSubmenu('Table Name Case');

    expect(namesOf(submenu)).toEqual(['Pascal', 'Camel', 'Snake', 'None']);
    expect(checkedNameOf(submenu)).toEqual(['Pascal']);

    const snake = rowsOf(submenu).find(row =>
      row.textContent?.includes('Snake')
    ) as HTMLElement;
    snake.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(app.store.state.settings.tableNameCase).toBe(NameCase.snakeCase);
  });

  it('opens the column name case submenu with the active case checked', async () => {
    const { app } = await openMenu();

    const submenu = await openSubmenu('Column Name Case');

    expect(namesOf(submenu)).toEqual(['Pascal', 'Camel', 'Snake', 'None']);
    expect(checkedNameOf(submenu)).toEqual(['Camel']);

    const none = rowsOf(submenu).find(row =>
      row.textContent?.includes('None')
    ) as HTMLElement;
    none.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(app.store.state.settings.columnNameCase).toBe(NameCase.none);
  });

  it('keeps only one submenu open at a time', async () => {
    await openMenu();

    await openSubmenu('Language');
    expect(contentsOf(mounted as Mounted)).toHaveLength(2);

    const submenu = await openSubmenu('Column Name Case');
    expect(contentsOf(mounted as Mounted)).toHaveLength(2);
    expect(namesOf(submenu)).toEqual(['Pascal', 'Camel', 'Snake', 'None']);
  });

  it('calls onClose when the stop shortcut fires', async () => {
    const onClose = vi.fn();
    await openMenu(onClose);

    (mounted as Mounted).app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown'),
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts other than stop', async () => {
    const onClose = vi.fn();
    await openMenu(onClose);

    (mounted as Mounted).app.shortcut$.next({
      type: KeyBindingName.addTable,
      event: new KeyboardEvent('keydown'),
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('unsubscribes from the shortcut stream when it is torn down', async () => {
    const onClose = vi.fn();
    await openMenu(onClose);
    const app = (mounted as Mounted).app;

    expect(app.shortcut$.observed).toBe(true);

    (mounted as Mounted).unmount();
    mounted = null;
    await flush();

    expect(app.shortcut$.observed).toBe(false);

    app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown'),
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
