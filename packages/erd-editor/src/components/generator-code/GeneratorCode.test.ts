import { FC, html, observable } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

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
import GeneratorCode from '@/components/generator-code/GeneratorCode';
import { generatorCodeViewOf } from '@/components/generator-code/generatorCodeView';
import * as styles from '@/components/schema-sql/SchemaSQL.styles';
import {
  BracketType,
  Database,
  Language,
  LockSettingType,
  NameCase,
} from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  changeBracketTypeAction,
  changeColumnNameCaseAction,
  changeDatabaseAction,
  changeDatabaseNameAction,
  changeLanguageAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { createI18n } from '@/i18n/translate';
import type { ShikiService } from '@/services/shiki';
import { bHas } from '@/utils/bit';
import { setExportFileCallback } from '@/utils/file/exportFile';
import {
  createGeneratorCode,
  createGeneratorCodeTable,
} from '@/utils/generator-code';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const mocks = vi.hoisted(() => ({
  getShikiService: vi.fn<() => ShikiService | null>(() => null),
}));

vi.mock('@/services/shiki', () => ({
  getShikiService: mocks.getShikiService,
}));

/** What the code block reads; the worker itself is nothing this spec builds. */
const setShikiService = (service: ShikiService | null) => {
  mocks.getShikiService.mockImplementation(() => service);
};

let mounted: Mounted | null = null;
let clipboardDescriptor: PropertyDescriptor | undefined;
let writeText = vi.fn(async () => {});

function seedSchema(app: AppContext) {
  const { store } = app;

  store.dispatchSync(
    addTableAction({ id: 'table-a', ui: { x: 0, y: 0, zIndex: 1 } })
  );
  store.dispatchSync(changeTableNameAction({ id: 'table-a', value: 'user' }));
  store.dispatchSync(addColumnAction({ id: 'col-a', tableId: 'table-a' }));
  store.dispatchSync(
    changeColumnNameAction({
      tableId: 'table-a',
      id: 'col-a',
      value: 'user_name',
    })
  );
  store.dispatchSync(
    changeColumnDataTypeAction({
      tableId: 'table-a',
      id: 'col-a',
      value: 'varchar',
    })
  );

  store.dispatchSync(
    addTableAction({ id: 'table-b', ui: { x: 0, y: 0, zIndex: 2 } })
  );
  store.dispatchSync(changeTableNameAction({ id: 'table-b', value: 'post' }));

  return app;
}

const createSeededApp = () => seedSchema(createTestAppContext());

const rootOf = (m: Mounted) =>
  m.container.querySelector(`.${String(styles.root)}`) as HTMLDivElement;

/** The code's side of the tab, where a right click opens the menu. */
const codeAreaOf = (m: Mounted) =>
  rootOf(m).firstElementChild as HTMLDivElement;

const panelOf = (m: Mounted) =>
  m.container.querySelector<HTMLElement>('aside.generator-code-options');

const showButtonOf = (m: Mounted) =>
  m.container.querySelector<HTMLButtonElement>('.generator-code-options-show');

/** An editor measured this wide, which is what decides whether the panel opens. */
const measure = (app: AppContext, width: number) => {
  app.store.dispatchSync(changeViewportAction({ width, height: 800 }));
};

/** A row of the menu by its text, which a click runs. */
const menuRowOf = (m: Mounted, text: string) =>
  Array.from(contentOf(m)?.children ?? []).find(
    row => row.textContent?.trim() === text
  ) as HTMLElement | undefined;

const codeOf = (m: Mounted) =>
  m.container.querySelector('.scrollbar') as HTMLDivElement;

/**
 * CodeBlock strips the generators' trailing blank line, which a textarea turns into a real last
 * line and a block container does not.
 */
const rendered = (code: string) => code.replace(/\n+$/, '');

const copyButtonOf = (m: Mounted) =>
  m.container.querySelector('[title="Copy"]') as HTMLDivElement;

const contentOf = (m: Mounted) =>
  m.container.querySelector('.context-menu-content') as HTMLElement | null;

const createShikiService = () => {
  const codeToHtml = vi.fn<ShikiService['codeToHtml']>(async () => '');
  const service: ShikiService = { codeToHtml } as unknown as ShikiService;
  return { service, codeToHtml };
};

function openContextMenu(m: Mounted, x = 30, y = 40) {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  codeAreaOf(m).dispatchEvent(event);
  return event;
}

beforeEach(() => {
  writeText = vi.fn(async () => {});
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  setExportFileCallback(null);
  mounted?.unmount();
  mounted = null;
  setShikiService(null);

  if (clipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
});

describe('GeneratorCode', () => {
  it('renders the whole-schema code inside the styled root', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    const root = rootOf(mounted);
    expect(root).toBeTruthy();
    expect(root.contains(codeOf(mounted))).toBe(true);
    expect(codeOf(mounted).textContent).toBe(
      rendered(createGeneratorCode(app.store.state))
    );
    expect(codeOf(mounted).textContent).toContain('type User {');
    expect(codeOf(mounted).textContent).toContain('userName: String');
    // post is seeded without a column, and a GraphQL type with no field is
    // written braceless -- type Post {} is a syntax error.
    expect(codeOf(mounted).textContent).toContain('type Post');
  });

  it('renders only the requested table when tableId is given', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} tableId=${'table-a'} />`,
      app
    );

    const table = app.store.state.collections.tableEntities['table-a'];
    expect(codeOf(mounted).textContent).toBe(
      rendered(createGeneratorCodeTable(app.store.state, table))
    );
    expect(codeOf(mounted).textContent).toContain('type User {');
    expect(codeOf(mounted).textContent).not.toContain('type Post');
  });

  it('leaves the code empty when tableId matches no table', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} tableId=${'missing'} />`,
      app
    );

    expect(codeOf(mounted).textContent).toBe('');
  });

  it('regenerates when the tableId prop changes', async () => {
    const app = createSeededApp();
    const state = observable({ tableId: 'table-a' as string | undefined });
    const Parent: FC<any> = () => () =>
      html`<${GeneratorCode} isDarkMode=${false} tableId=${state.tableId} />`;

    mounted = await mountAndFlush(html`<${Parent} />`, app);
    expect(codeOf(mounted).textContent).toContain('type User {');

    state.tableId = 'table-b';
    await flush();
    expect(codeOf(mounted).textContent).toContain('type Post');
    expect(codeOf(mounted).textContent).not.toContain('type User {');

    state.tableId = undefined;
    await flush();
    expect(codeOf(mounted).textContent).toContain('type User {');
    expect(codeOf(mounted).textContent).toContain('type Post');
  });

  it('regenerates on a watched settings change and ignores the rest', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );
    expect(codeOf(mounted).textContent).toContain('userName: String');

    // A table rename alone does not re-run the generator.
    app.store.dispatchSync(
      changeTableNameAction({ id: 'table-a', value: 'account' })
    );
    await flush();
    expect(codeOf(mounted).textContent).toContain('type User {');

    // Neither does an unwatched settings key.
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    await flush();
    expect(codeOf(mounted).textContent).toContain('type User {');

    // A watched settings key flushes everything through.
    app.store.dispatchSync(
      changeColumnNameCaseAction({ value: NameCase.snakeCase })
    );
    await flush();
    expect(codeOf(mounted).textContent).toContain('type Account {');
    expect(codeOf(mounted).textContent).toContain('user_name: String');
  });

  it('regenerates on a database change, which the types follow', async () => {
    const app = createSeededApp();
    app.store.dispatchSync(
      changeLanguageAction({ value: Language.Rust }),
      changeColumnDataTypeAction({
        tableId: 'table-a',
        id: 'col-a',
        value: 'text[]',
      }),
      changeDatabaseAction({ value: Database.MySQL })
    );
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );
    const before = codeOf(mounted).textContent;

    app.store.dispatchSync(
      changeDatabaseAction({ value: Database.PostgreSQL })
    );
    await flush();

    expect(before).toContain('pub userName: Option<String>,');
    expect(codeOf(mounted).textContent).toContain(
      'pub userName: Option<Vec<String>>,'
    );
    expect(codeOf(mounted).textContent).toBe(
      rendered(createGeneratorCode(app.store.state))
    );
  });

  it('regenerates on a bracket type change, which the Doctrine names follow', async () => {
    const app = createSeededApp();
    app.store.dispatchSync(changeLanguageAction({ value: Language.Doctrine }));
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );
    expect(codeOf(mounted).textContent).not.toContain("name: '`user_name`'");

    app.store.dispatchSync(
      changeBracketTypeAction({ value: BracketType.doubleQuote })
    );
    await flush();

    expect(codeOf(mounted).textContent).toBe(
      rendered(createGeneratorCode(app.store.state))
    );
    expect(codeOf(mounted).textContent).toContain("name: '`user_name`'");
  });

  it('regenerates for the language setting and passes the mapped lang to the code block', async () => {
    const app = createSeededApp();
    const { service, codeToHtml } = createShikiService();
    setShikiService(service);

    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    expect(codeToHtml.mock.calls.at(-1)?.[1]).toEqual({
      lang: 'graphql',
      theme: 'light',
    });

    app.store.dispatchSync(
      changeLanguageAction({ value: Language.TypeScript })
    );
    await flush();

    expect(codeToHtml.mock.calls.at(-1)?.[1]).toEqual({
      lang: 'typescript',
      theme: 'light',
    });
    expect(codeToHtml.mock.calls.at(-1)?.[0]).toBe(
      rendered(createGeneratorCode(app.store.state))
    );
  });

  it('maps the JPA language onto the java grammar', async () => {
    const app = createSeededApp();
    app.store.dispatchSync(changeLanguageAction({ value: Language.JPA }));

    const { service, codeToHtml } = createShikiService();
    setShikiService(service);

    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    expect(codeToHtml.mock.calls.at(-1)?.[1]).toEqual({
      lang: 'java',
      theme: 'light',
    });
  });

  it('forwards the dark theme when isDarkMode is set', async () => {
    const app = createSeededApp();
    const { service, codeToHtml } = createShikiService();
    setShikiService(service);

    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${true} />`,
      app
    );

    expect(codeToHtml.mock.calls.at(-1)?.[1]).toEqual({
      lang: 'graphql',
      theme: 'dark',
    });
  });

  it('copies the generated code and opens a toast', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    const openToast = vi.fn();
    app.emitter.on({ openToast });

    copyButtonOf(mounted).dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await flush();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(
      createGeneratorCode(app.store.state)
    );
    expect(openToast).toHaveBeenCalledTimes(1);
    expect(openToast.mock.calls[0][0].payload.message).toBeTruthy();
    expect(openToast.mock.calls[0][0].payload.close).toBeInstanceOf(Promise);
  });

  it('says Copied! in the toast, in the language the element shows', async () => {
    const app = createSeededApp();
    const openToast = vi.fn();
    app.emitter.on({ openToast });
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );
    copyButtonOf(mounted).dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await flush();
    const { message } = openToast.mock.calls[0][0].payload;

    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);
    const toast = await mountAndFlush(message, app);

    try {
      expect(toast.container.textContent?.trim()).toBe('Copied!');

      Object.assign(i18n, createI18n('ja-JP', pseudoMessages('ja')));
      await flush();

      expect(toast.container.textContent?.trim()).toBe('ja:Copied!');
    } finally {
      toast.unmount();
      provider.destroy();
    }
  });

  it('opens the generator context menu on contextmenu and cancels the native one', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    expect(contentOf(mounted)).toBeNull();

    const event = openContextMenu(mounted, 30, 40);
    expect(event.defaultPrevented).toBe(true);

    await flush();

    const content = contentOf(mounted) as HTMLElement;
    expect(content).toBeTruthy();
    expect(content.textContent).toContain('Language');
    expect(content.textContent).toContain('Table Name Case');
    expect(content.textContent).toContain('Column Name Case');
  });

  it('positions the context menu at the pointer', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    openContextMenu(mounted, 120, 240);
    await flush();

    const content = contentOf(mounted) as HTMLElement;
    expect(content.style.left).toBe('120px');
    expect(content.style.top).toBe('240px');
  });

  it('closes the context menu on a mousedown outside the menu content', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    openContextMenu(mounted);
    await flush();
    expect(contentOf(mounted)).toBeTruthy();

    rootOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true })
    );
    await flush();

    expect(contentOf(mounted)).toBeNull();
  });

  it('keeps the context menu open on a mousedown inside the menu content', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    openContextMenu(mounted);
    await flush();

    const content = contentOf(mounted) as HTMLElement;
    content.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flush();

    expect(contentOf(mounted)).toBeTruthy();
  });

  it('closes the context menu when the stop shortcut fires', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    openContextMenu(mounted);
    await flush();
    expect(contentOf(mounted)).toBeTruthy();

    app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown'),
    });
    await flush();

    expect(contentOf(mounted)).toBeNull();
  });

  it('stops regenerating once it is unmounted', async () => {
    const app = createSeededApp();
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    const container = mounted.container;
    mounted.unmount();
    mounted = null;

    app.store.dispatchSync(
      changeLanguageAction({ value: Language.TypeScript })
    );
    await flush();

    expect(container.querySelector('.scrollbar')).toBeNull();
  });

  it('opens the options panel on an editor 640 wide or more, once measured', async () => {
    const app = createSeededApp();
    measure(app, 0);
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );
    expect(panelOf(mounted)).toBeNull();
    expect(showButtonOf(mounted)).toBeNull();
    expect(generatorCodeViewOf(app).panel).toBe('unset');

    measure(app, 640);
    await flush();

    expect(panelOf(mounted)).toBeTruthy();
    expect(showButtonOf(mounted)).toBeNull();
    expect(generatorCodeViewOf(app).panel).toBe('open');
  });

  it('folds the panel away on a narrower editor, leaving Show options over the code', async () => {
    const app = createSeededApp();
    measure(app, 639);
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    const show = showButtonOf(mounted) as HTMLButtonElement;
    expect(panelOf(mounted)).toBeNull();
    expect(show.getAttribute('aria-label')).toBe('Show options');
    expect(show.getAttribute('title')).toBe('Show options');
    expect(show.getAttribute('aria-expanded')).toBe('false');
    expect(codeAreaOf(mounted).contains(show)).toBe(true);
  });

  it('keeps its fold apart from the Schema SQL tab, and keeps it across a remount', async () => {
    const app = createSeededApp();
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );
    (
      mounted.container.querySelector(
        '.generator-code-options-hide'
      ) as HTMLElement
    ).click();
    await flush();
    mounted.unmount();

    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    expect(panelOf(mounted)).toBeNull();
    expect(showButtonOf(mounted)).toBeTruthy();
  });

  it("keeps the code left of the panel in every language, the panel and the menu in the reader's direction", async () => {
    const app = createSeededApp();
    measure(app, 1280);
    const i18n = createTestI18n('ar-SA');
    const provider = provideI18n(document.body, i18n);

    try {
      mounted = await mountAndFlush(
        html`<${GeneratorCode} isDarkMode=${false} />`,
        app
      );
      expect(rootOf(mounted).dir).toBe('ltr');
      expect(panelOf(mounted)?.dir).toBe('rtl');

      openContextMenu(mounted);
      await flush();
      expect(contentOf(mounted)?.parentElement?.dir).toBe('rtl');
    } finally {
      provider.destroy();
    }
  });

  it('hides the panel and hands the focus to Show options, and back to Hide options', async () => {
    const app = createSeededApp();
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    (
      mounted.container.querySelector(
        '.generator-code-options-hide'
      ) as HTMLElement
    ).click();
    await flush();

    expect(panelOf(mounted)).toBeNull();
    expect(generatorCodeViewOf(app).panel).toBe('closed');
    expect(document.activeElement).toBe(showButtonOf(mounted));

    (showButtonOf(mounted) as HTMLButtonElement).click();
    await flush();

    expect(panelOf(mounted)).toBeTruthy();
    expect(document.activeElement).toBe(
      mounted.container.querySelector('.generator-code-options-hide')
    );
  });

  it('keeps Space on Show options from the hand tool, unprevented', async () => {
    const app = createSeededApp();
    measure(app, 600);
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );
    const behind = vi.fn();
    mounted.container.addEventListener('keydown', behind);

    const space = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    showButtonOf(mounted)?.dispatchEvent(space);

    expect(space.defaultPrevented).toBe(false);
    expect(behind).not.toHaveBeenCalled();
  });

  it("saves the text it shows from Save file, named after the database with the language's extension", async () => {
    const app = createSeededApp();
    app.store.dispatchSync(
      changeDatabaseNameAction({ value: 'shop' }),
      changeLanguageAction({ value: Language.TypeScript })
    );
    measure(app, 1280);
    const files: Array<{ blob: Blob; fileName: string }> = [];
    setExportFileCallback((blob, { fileName }) =>
      files.push({ blob, fileName })
    );
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    (
      mounted.container.querySelector(
        '.generator-code-options-save'
      ) as HTMLElement
    ).click();

    expect(files).toHaveLength(1);
    expect(files[0].fileName).toMatch(
      /^shop-\d{4}-\d{2}-\d{2}T\d{2}_\d{2}_\d{2}\.ts$/
    );
    expect(await files[0].blob.text()).toBe(
      createGeneratorCode(app.store.state)
    );

    app.store.dispatchSync(
      changeDatabaseNameAction({ value: '' }),
      changeLanguageAction({ value: Language.Mermaid })
    );
    await flush();
    (
      mounted.container.querySelector(
        '.generator-code-options-save'
      ) as HTMLElement
    ).click();

    expect(files[1].fileName).toMatch(/^unnamed-.*\.mmd$/);
  });

  it("copies the text it shows from the panel's Copy too, with the same toast", async () => {
    const app = createSeededApp();
    measure(app, 1280);
    const openToast = vi.fn();
    app.emitter.on({ openToast });
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    (
      mounted.container.querySelector(
        '.generator-code-options-copy'
      ) as HTMLElement
    ).click();
    await flush();

    expect(writeText).toHaveBeenCalledWith(
      createGeneratorCode(app.store.state)
    );
    expect(openToast).toHaveBeenCalledTimes(1);
  });

  it('leaves a right click in the panel to the browser', async () => {
    const app = createSeededApp();
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    panelOf(mounted)?.dispatchEvent(event);
    await flush();

    expect(event.defaultPrevented).toBe(false);
    expect(contentOf(mounted)).toBeNull();
  });

  it("shows one table's code alone, no panel, no Show options and no panel rows in its menu", async () => {
    const app = createSeededApp();
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} tableId=${'table-a'} />`,
      app
    );

    expect(panelOf(mounted)).toBeNull();
    expect(showButtonOf(mounted)).toBeNull();
    expect(generatorCodeViewOf(app).panel).toBe('unset');

    openContextMenu(mounted);
    await flush();
    const text = contentOf(mounted)?.textContent ?? '';
    expect(text).toContain('Database');
    expect(text).not.toContain('Options panel');
    expect(text).not.toContain('Save file…');
  });

  it("adds the panel and Save file to the whole document's menu, each closing it", async () => {
    const app = createSeededApp();
    measure(app, 1280);
    const files: string[] = [];
    setExportFileCallback((_, { fileName }) => files.push(fileName));
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );

    openContextMenu(mounted);
    await flush();
    menuRowOf(mounted, 'Save file…')?.click();
    await flush();

    expect(files).toEqual([expect.stringMatching(/^unnamed-.*\.graphql$/)]);
    expect(contentOf(mounted)).toBeNull();

    openContextMenu(mounted);
    await flush();
    menuRowOf(mounted, 'Options panel')?.click();
    await flush();

    expect(contentOf(mounted)).toBeNull();
    expect(panelOf(mounted)).toBeNull();
    expect(generatorCodeViewOf(app).panel).toBe('closed');
  });

  it('writes again when the panel changes a setting, the language locked and the database not', async () => {
    const app = createSeededApp();
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${GeneratorCode} isDarkMode=${false} />`,
      app
    );
    const { lockSettings } = app.store.state.settings;
    expect(bHas(lockSettings, LockSettingType.language)).toBe(true);

    const language = mounted.container.querySelector<HTMLSelectElement>(
      '#generator-code-language'
    )!;
    language.value = String(Language.TypeScript);
    language.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(app.store.state.settings.language).toBe(Language.TypeScript);
    expect(codeOf(mounted).textContent).toBe(
      rendered(createGeneratorCode(app.store.state))
    );
    expect(codeOf(mounted).textContent).toContain('export interface User');
  });
});
