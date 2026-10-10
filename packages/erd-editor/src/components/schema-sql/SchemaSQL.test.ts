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
import SchemaSQL from '@/components/schema-sql/SchemaSQL';
import { schemaSQLViewOf } from '@/components/schema-sql/schemaSQLView';
import { BracketType, Database } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  changeBracketTypeAction,
  changeDatabaseAction,
  changeDatabaseNameAction,
  changeDDLScriptAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import {
  addTableGroupAction,
  changeTableGroupNameAction,
  removeTableGroupAction,
} from '@/engine/modules/table-group/atom.actions';
import { createI18n } from '@/i18n/translate';
import type { ShikiService } from '@/services/shiki';
import { openToastAction } from '@/utils/emitter';
import { setExportFileCallback } from '@/utils/file/exportFile';
import { createSchemaSQL } from '@/utils/schema-sql';

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

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard'
);

let mounted: Mounted | null = null;
const apps: AppContext[] = [];

/** A context destroyed after the case, so no hook timer its edits set outlives the file's DOM. */
function createApp(): AppContext {
  const app = createTestAppContext();
  apps.push(app);
  return app;
}

function seedTable(app: AppContext, id: string, name: string) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }),
    changeTableNameAction({ id, value: name })
  );
  app.store.dispatchSync(addColumnAction({ tableId: id, id: `${id}-col` }));
}

const createCodeToHtml = () =>
  vi.fn(
    async (_value: string, _options: { lang: string; theme?: string }) =>
      '<pre class="shiki"></pre>'
  );

const codeOf = (m: Mounted) =>
  m.container.querySelector('.scrollbar') as HTMLDivElement;

const rootOf = (m: Mounted) => m.container.firstElementChild as HTMLDivElement;

/** The code's side of the tab, where a right click opens the menu. */
const codeAreaOf = (m: Mounted) =>
  rootOf(m).firstElementChild as HTMLDivElement;

const panelOf = (m: Mounted) =>
  m.container.querySelector<HTMLElement>('aside.schema-sql-options');

const showButtonOf = (m: Mounted) =>
  m.container.querySelector<HTMLButtonElement>('.schema-sql-options-show');

/** An editor measured this wide, which is what decides whether the panel opens. */
const measure = (app: AppContext, width: number) => {
  app.store.dispatchSync(changeViewportAction({ width, height: 800 }));
};

const contentOf = (m: Mounted) =>
  m.container.querySelector('.context-menu-content') as HTMLElement | null;

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  setExportFileCallback(null);
  mounted?.unmount();
  mounted = null;
  apps.splice(0).forEach(app => app.store.destroy());
  setShikiService(null);

  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
  } else {
    delete (navigator as any).clipboard;
  }
});

describe('SchemaSQL', () => {
  it('renders a relative root that hosts the code block', async () => {
    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${false} />`);

    const root = rootOf(mounted);
    expect(root.tagName).toBe('DIV');
    expect(root.className).not.toBe('');
    expect(codeOf(mounted)).toBeTruthy();
    expect(mounted.container.querySelector('[title="Copy"]')).toBeTruthy();
  });

  it('renders the generated schema sql for the whole document', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    expect(codeOf(mounted).textContent).toContain(
      'CREATE TABLE IF NOT EXISTS users'
    );
  });

  it("writes the whole document with the window's statements and header, if not exists and create and use at first", async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    const expected = createSchemaSQL(app.store.state, undefined, undefined, {
      statements: 'ifNotExists',
      header: 'createAndUse',
    });
    expect(expected.startsWith('\nCREATE DATABASE IF NOT EXISTS shop;')).toBe(
      true
    );
    expect(codeOf(mounted).textContent).toBe(expected.replace(/\n+$/, ''));
  });

  it("writes again when the window's statements or header change, and not for the panel", async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );
    const view = schemaSQLViewOf(app);

    view.statements = 'create';
    await flush();
    expect(codeOf(mounted).textContent).toContain('CREATE TABLE users');

    view.header = 'none';
    await flush();
    expect(codeOf(mounted).textContent).not.toContain('CREATE DATABASE');

    app.store.dispatchSync(
      changeTableNameAction({ id: 't1', value: 'renamed' })
    );
    view.panel = 'closed';
    await flush();
    expect(codeOf(mounted).textContent).toContain('CREATE TABLE users');
  });

  it('writes again when the scripts or the database name change', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    app.store.dispatchSync(
      changeDDLScriptAction({ position: 'after', value: 'GRANT ALL;' })
    );
    await flush();
    expect(codeOf(mounted).textContent?.endsWith('GRANT ALL;')).toBe(true);

    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    await flush();
    expect(codeOf(mounted).textContent).toContain('USE shop;');
  });

  it('renders an empty schema when the document has no tables', async () => {
    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${false} />`);

    expect(codeOf(mounted).textContent).not.toContain('CREATE TABLE');
  });

  it('renders only the requested table when tableId is given', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    seedTable(app, 't2', 'posts');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} tableId=${'t2'} />`,
      app
    );

    const text = codeOf(mounted).textContent ?? '';
    expect(text).toContain('CREATE TABLE posts');
    expect(text).not.toContain('CREATE TABLE users');
  });

  it('leaves the sql empty when tableId points at a missing table', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} tableId=${'nope'} />`,
      app
    );

    expect(codeOf(mounted).textContent).toBe('');
  });

  it('passes the dark theme to the code block when isDarkMode is true', async () => {
    const codeToHtml = createCodeToHtml();
    setShikiService({ codeToHtml } as unknown as ShikiService);

    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${true} />`);

    expect(codeToHtml.mock.calls.at(-1)?.[1]).toEqual({
      lang: 'sql',
      theme: 'dark',
    });
  });

  it('passes the light theme to the code block when isDarkMode is false', async () => {
    const codeToHtml = createCodeToHtml();
    setShikiService({ codeToHtml } as unknown as ShikiService);

    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${false} />`);

    expect(codeToHtml.mock.calls.at(-1)?.[1]).toEqual({
      lang: 'sql',
      theme: 'light',
    });
  });

  it('regenerates the sql when the database setting changes', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );
    expect(codeOf(mounted).textContent).toContain(
      'CREATE TABLE IF NOT EXISTS users'
    );

    app.store.dispatchSync(
      changeTableNameAction({ id: 't1', value: 'accounts' }),
      changeDatabaseAction({ value: Database.PostgreSQL })
    );
    await flush();

    expect(codeOf(mounted).textContent).toContain(
      'CREATE TABLE IF NOT EXISTS accounts'
    );
    expect(app.store.state.settings.database).toBe(Database.PostgreSQL);
  });

  it('regenerates the sql when the bracket type setting changes', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );
    expect(codeOf(mounted).textContent).toContain(
      'CREATE TABLE IF NOT EXISTS users'
    );

    app.store.dispatchSync(
      changeBracketTypeAction({ value: BracketType.backtick })
    );
    await flush();

    expect(codeOf(mounted).textContent).toContain(
      'CREATE TABLE IF NOT EXISTS `users`'
    );
  });

  it('ignores settings changes that cannot affect the sql', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );
    const before = codeOf(mounted).textContent;

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    expect(codeOf(mounted).textContent).toBe(before);
  });

  it('regenerates the sql when the tableId prop changes', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    seedTable(app, 't2', 'posts');

    const state = observable({
      tableId: 't1' as string | undefined,
      isDarkMode: false,
    });
    const Parent: FC<any> = () => () =>
      html`<${SchemaSQL}
        isDarkMode=${state.isDarkMode}
        tableId=${state.tableId}
      />`;

    mounted = await mountAndFlush(html`<${Parent} />`, app);
    expect(codeOf(mounted).textContent).toContain('CREATE TABLE users');

    state.tableId = 't2';
    await flush();

    const text = codeOf(mounted).textContent ?? '';
    expect(text).toContain('CREATE TABLE posts');
    expect(text).not.toContain('CREATE TABLE users');
  });

  it('does not regenerate the sql when an unwatched prop changes', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');

    const state = observable({
      tableId: 't1' as string | undefined,
      isDarkMode: false,
    });
    const Parent: FC<any> = () => () =>
      html`<${SchemaSQL}
        isDarkMode=${state.isDarkMode}
        tableId=${state.tableId}
      />`;

    mounted = await mountAndFlush(html`<${Parent} />`, app);
    const before = codeOf(mounted).textContent;

    app.store.dispatchSync(
      changeTableNameAction({ id: 't1', value: 'renamed' })
    );
    state.isDarkMode = true;
    await flush();

    expect(codeOf(mounted).textContent).toBe(before);
  });

  it('opens the schema sql context menu on contextmenu', async () => {
    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${false} />`);

    codeAreaOf(mounted).dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 30,
        clientY: 40,
      })
    );
    await flush();

    const content = contentOf(mounted) as HTMLElement;
    expect(content).toBeTruthy();
    expect(content.dataset.id).toBe('root');
    expect(content.style.left).toBe('30px');
    expect(content.style.top).toBe('40px');
    expect(content.textContent).toContain('Database');
    expect(content.textContent).toContain('Bracket');
  });

  it('prevents the native context menu', async () => {
    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${false} />`);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    codeAreaOf(mounted).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('closes the context menu on a mousedown outside the menu content', async () => {
    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${false} />`);

    codeAreaOf(mounted).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    );
    await flush();
    expect(contentOf(mounted)).toBeTruthy();

    codeOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true })
    );
    await flush();

    expect(contentOf(mounted)).toBeNull();
  });

  it('keeps the context menu open on a mousedown inside the menu content', async () => {
    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${false} />`);

    codeAreaOf(mounted).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    );
    await flush();

    (contentOf(mounted) as HTMLElement).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true })
    );
    await flush();

    expect(contentOf(mounted)).toBeTruthy();
  });

  it('closes the context menu when the child asks to close', async () => {
    const app = createApp();
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    codeAreaOf(mounted).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    );
    await flush();
    expect(contentOf(mounted)).toBeTruthy();

    app.shortcut$.next({
      type: 'stop' as any,
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    });
    await flush();

    expect(contentOf(mounted)).toBeNull();
  });

  it('copies the sql and emits a toast when the copy affordance is clicked', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    const openToast = vi.fn();
    app.emitter.on({ openToast });

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    (
      mounted.container.querySelector('[title="Copy"]') as HTMLElement
    ).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain(
      'CREATE TABLE IF NOT EXISTS users'
    );

    expect(openToast).toHaveBeenCalledTimes(1);
    const action = openToast.mock.calls[0][0];
    expect(action.type).toBe(openToastAction({} as any).type);
    expect(action.payload.message).toBeTruthy();
    expect(action.payload.close).toBeInstanceOf(Promise);
  });

  it('says Copied! in the toast, in the language the element shows', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    const openToast = vi.fn();
    app.emitter.on({ openToast });
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );
    (
      mounted.container.querySelector('[title="Copy"]') as HTMLElement
    ).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    const { message } = openToast.mock.calls[0][0].payload;

    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);
    const toast = await mountAndFlush(message, app);

    try {
      expect(toast.container.textContent?.trim()).toBe('Copied!');

      Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
      await flush();

      expect(toast.container.textContent?.trim()).toBe('ko:Copied!');
    } finally {
      toast.unmount();
      provider.destroy();
    }
  });

  it('stops reacting to store changes after unmount', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );
    const container = mounted.container;
    mounted.unmount();
    mounted = null;

    app.store.dispatchSync(
      changeBracketTypeAction({ value: BracketType.backtick })
    );
    await flush();

    expect(container.querySelector('.scrollbar')).toBeNull();
  });

  it('opens the options panel on an editor 640 wide or more, once measured', async () => {
    const app = createApp();
    measure(app, 0);
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );
    expect(panelOf(mounted)).toBeNull();
    expect(showButtonOf(mounted)).toBeNull();
    expect(schemaSQLViewOf(app).panel).toBe('unset');

    measure(app, 640);
    await flush();

    expect(panelOf(mounted)).toBeTruthy();
    expect(showButtonOf(mounted)).toBeNull();
    expect(schemaSQLViewOf(app).panel).toBe('open');
  });

  it('folds the panel away on a narrower editor, leaving Show options over the code', async () => {
    const app = createApp();
    measure(app, 639);
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    const show = showButtonOf(mounted) as HTMLButtonElement;
    expect(panelOf(mounted)).toBeNull();
    expect(show.getAttribute('aria-label')).toBe('Show options');
    expect(show.getAttribute('title')).toBe('Show options');
    expect(show.getAttribute('aria-expanded')).toBe('false');
    expect(codeAreaOf(mounted).contains(show)).toBe(true);
  });

  it("keeps the code left of the panel in every language, the panel and the menu in the reader's direction", async () => {
    const app = createApp();
    measure(app, 1280);
    const i18n = createTestI18n('ar-SA');
    const provider = provideI18n(document.body, i18n);

    try {
      mounted = await mountAndFlush(
        html`<${SchemaSQL} isDarkMode=${false} />`,
        app
      );
      expect(rootOf(mounted).dir).toBe('ltr');
      expect(panelOf(mounted)?.dir).toBe('rtl');

      codeAreaOf(mounted).dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      );
      await flush();
      expect(contentOf(mounted)?.parentElement?.dir).toBe('rtl');
    } finally {
      provider.destroy();
    }
  });

  it('hides the panel and hands the focus to Show options, and back to Hide options', async () => {
    const app = createApp();
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    (
      mounted.container.querySelector('.schema-sql-options-hide') as HTMLElement
    ).click();
    await flush();

    expect(panelOf(mounted)).toBeNull();
    expect(schemaSQLViewOf(app).panel).toBe('closed');
    expect(document.activeElement).toBe(showButtonOf(mounted));

    (showButtonOf(mounted) as HTMLButtonElement).click();
    await flush();

    expect(panelOf(mounted)).toBeTruthy();
    expect(document.activeElement).toBe(
      mounted.container.querySelector('.schema-sql-options-hide')
    );
  });

  it('keeps Space on Show options from the hand tool, unprevented', async () => {
    const app = createApp();
    measure(app, 600);
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
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

  it('saves the text it shows from Save file, named after the database', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    measure(app, 1280);
    const files: Array<{ blob: Blob; fileName: string }> = [];
    setExportFileCallback((blob, { fileName }) =>
      files.push({ blob, fileName })
    );
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    (
      mounted.container.querySelector('.schema-sql-options-save') as HTMLElement
    ).click();

    expect(files).toHaveLength(1);
    expect(files[0].fileName).toMatch(/^shop-.*\.sql$/);
    expect(await files[0].blob.text()).toBe(
      createSchemaSQL(app.store.state, undefined, undefined, {
        statements: 'ifNotExists',
        header: 'createAndUse',
      })
    );
  });

  it("copies the text it shows from the panel's Copy too", async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    (
      mounted.container.querySelector('.schema-sql-options-copy') as HTMLElement
    ).click();
    await flush();

    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    expect(writeText.mock.calls[0][0]).toContain(
      'CREATE TABLE IF NOT EXISTS users'
    );
  });

  it('leaves a right click in the panel to the browser', async () => {
    const app = createApp();
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
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

  it('names the Oracle names over 30 bytes under the database, and none elsewhere', async () => {
    const app = createApp();
    seedTable(app, 't1', 'a_table_name_well_over_thirty_bytes');
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );
    const note = () =>
      mounted?.container.querySelector('.schema-sql-options-long-names');
    expect(note()).toBeNull();

    app.store.dispatchSync(changeDatabaseAction({ value: Database.Oracle }));
    await flush();

    expect(note()?.textContent).toBe(
      'Oracle 12.2+ for names over 30 bytes: a_table_name_well_over_thirty_bytes'
    );
  });

  it("hands the panel the element's readonly, which keeps the scripts from typing", async () => {
    const app = createApp();
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} readonly=${true} />`,
      app
    );

    const scripts = Array.from(
      mounted.container.querySelectorAll('textarea[id^="schema-sql-"]')
    ) as HTMLTextAreaElement[];
    expect(scripts.map(script => script.readOnly)).toEqual([true, true]);
  });

  it("shows one table's create alone, no panel and no Show options, whatever the width", async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} tableId=${'t1'} />`,
      app
    );

    expect(panelOf(mounted)).toBeNull();
    expect(showButtonOf(mounted)).toBeNull();
    expect(codeOf(mounted).textContent).toContain('CREATE TABLE users');

    codeAreaOf(mounted).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    );
    await flush();
    expect(contentOf(mounted)?.textContent).not.toContain('Statements');
  });

  it("adds the statements, the header, the panel and Save file to the whole document's menu", async () => {
    const app = createApp();
    measure(app, 1280);
    const files: string[] = [];
    setExportFileCallback((_, { fileName }) => files.push(fileName));
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    codeAreaOf(mounted).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    );
    await flush();

    const text = contentOf(mounted)?.textContent ?? '';
    expect(text).toContain('Statements');
    expect(text).toContain('Save file…');

    const saveRow = Array.from(contentOf(mounted)?.children ?? []).find(row =>
      row.textContent?.includes('Save file…')
    ) as HTMLElement;
    saveRow.click();
    await flush();

    expect(files).toHaveLength(1);
    expect(contentOf(mounted)).toBeNull();
  });
});

const GROUP_UI = { x: 0, y: 0, width: 200, height: 200, zIndex: 1 };

/**
 * users and posts in Sales, red, audit in a group with no name, logs in no
 * group, and the two scripts around them.
 */
function seedGroups(app: AppContext) {
  seedTable(app, 't1', 'users');
  seedTable(app, 't2', 'posts');
  seedTable(app, 't3', 'audit');
  seedTable(app, 't4', 'logs');
  app.store.dispatchSync(
    addTableGroupAction({ id: 'ga', color: '#ff0000', ui: GROUP_UI }),
    changeTableGroupNameAction({ id: 'ga', value: 'Sales' }),
    addTableGroupAction({ id: 'gb', ui: GROUP_UI }),
    changeTableGroupAction({ id: 't1', value: 'ga' }),
    changeTableGroupAction({ id: 't2', value: 'ga' }),
    changeTableGroupAction({ id: 't3', value: 'gb' }),
    changeDDLScriptAction({ position: 'before', value: 'SET a;' }),
    changeDDLScriptAction({ position: 'after', value: 'SET b;' })
  );
}

const tablesOf = (m: Mounted) =>
  m.container.querySelector<HTMLElement>('.schema-sql-options-tables');

const rowsOf = (m: Mounted) =>
  Array.from(tablesOf(m)?.querySelectorAll('label') ?? []);

const boxesOf = (m: Mounted) =>
  rowsOf(m).map(row => row.querySelector('input') as HTMLInputElement);

const checkedOf = (m: Mounted) => boxesOf(m).map(box => box.checked);

const labelsOf = (m: Mounted) =>
  rowsOf(m).map(row => row.textContent?.trim() ?? '');

/** The text the tab writes for these tables, the scripts kept, as the code block shows it. */
const shownFor = (app: AppContext, tableIds?: string[]) =>
  createSchemaSQL(app.store.state, undefined, tableIds, {
    statements: 'ifNotExists',
    header: 'createAndUse',
    scripts: true,
  }).replace(/\n+$/, '');

async function mountGrouped(readonly = false) {
  const app = createApp();
  seedGroups(app);
  measure(app, 1280);
  mounted = await mountAndFlush(
    html`<${SchemaSQL} isDarkMode=${false} readonly=${readonly} />`,
    app
  );
  return { app, m: mounted };
}

describe('SchemaSQL tables by group', () => {
  it('shows no Tables while the document has no table group', async () => {
    const app = createApp();
    seedTable(app, 't1', 'users');
    measure(app, 1280);
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    expect(panelOf(mounted)).not.toBeNull();
    expect(tablesOf(mounted)).toBeNull();
  });

  it('lists All, each group in document order with its colour or unnamed, then No group, all checked for the whole document', async () => {
    const { app, m } = await mountGrouped();

    expect(labelsOf(m)).toEqual(['All', 'Sales', 'unnamed', 'No group']);
    expect(checkedOf(m)).toEqual([true, true, true, true]);
    expect(boxesOf(m)[0].indeterminate).toBe(false);
    expect(
      rowsOf(m).map(
        row =>
          row.querySelector('span[aria-hidden]')?.getAttribute('style') ?? null
      )
    ).toEqual([null, 'background-color: #ff0000;', null, null]);
    expect(
      rowsOf(m).map(row =>
        row.querySelector('span:last-child')?.classList.contains('unnamed')
      )
    ).toEqual([false, false, true, false]);
    expect(codeOf(m).textContent).toBe(shownFor(app));
    expect(codeOf(m).textContent).toBe(
      createSchemaSQL(app.store.state, undefined, undefined, {
        statements: 'ifNotExists',
        header: 'createAndUse',
      }).replace(/\n+$/, '')
    );
  });

  it('writes the tables of the checked boxes with the scripts, and saves and copies what it shows', async () => {
    const { app, m } = await mountGrouped();
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    const files: Array<{ blob: Blob; fileName: string }> = [];
    setExportFileCallback((blob, { fileName }) =>
      files.push({ blob, fileName })
    );

    boxesOf(m)[2].click();
    await flush();

    const shown = shownFor(app, ['t1', 't2', 't4']);
    expect(checkedOf(m)).toEqual([false, true, false, true]);
    expect(boxesOf(m)[0].indeterminate).toBe(true);
    expect(codeOf(m).textContent).toBe(shown);
    expect(shown).toContain('SET a;');
    expect(shown.endsWith('SET b;')).toBe(true);
    expect(shown).not.toContain('audit');

    (
      m.container.querySelector('.schema-sql-options-save') as HTMLElement
    ).click();
    (
      m.container.querySelector('.schema-sql-options-copy') as HTMLElement
    ).click();
    await flush();

    expect(files).toHaveLength(1);
    expect(files[0].fileName).toMatch(/^shop-.*\.sql$/);
    expect(await files[0].blob.text()).toBe(`${shown}\n`);
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    expect(writeText.mock.calls[0][0]).toBe(`${shown}\n`);
  });

  it('drops only the chosen tables and names only them in the warning', async () => {
    const { app, m } = await mountGrouped();
    schemaSQLViewOf(app).statements = 'recreate';
    await flush();

    boxesOf(m)[1].click();
    await flush();

    const code = codeOf(m).textContent ?? '';
    expect(code).toContain('DROP TABLE IF EXISTS audit;');
    expect(code).not.toContain('DROP TABLE IF EXISTS users;');
    expect(
      m.container.querySelector('.schema-sql-options-warning')?.textContent
    ).toBe('Drops audit and logs before creating them. Their rows are lost.');
  });

  it('writes nothing with no box checked and says why over the empty code', async () => {
    const { app, m } = await mountGrouped();
    app.store.dispatchSync(changeDatabaseAction({ value: Database.Oracle }));
    schemaSQLViewOf(app).statements = 'recreate';
    await flush();
    const hint = () => m.container.querySelector('.schema-sql-no-table');
    expect(hint()).toBeNull();

    boxesOf(m)[0].click();
    await flush();

    expect(checkedOf(m)).toEqual([false, false, false, false]);
    expect(boxesOf(m)[0].indeterminate).toBe(false);
    expect(codeOf(m).textContent).toBe('');
    expect(hint()?.textContent).toBe(
      'No tables chosen. Check some under Tables.'
    );
    expect(m.container.querySelector('.schema-sql-options-warning')).toBeNull();

    boxesOf(m)[3].click();
    await flush();

    expect(hint()).toBeNull();
    expect(codeOf(m).textContent).toContain('logs');
  });

  it('checks every box from a mixed All and unchecks every box from a full one', async () => {
    const { app, m } = await mountGrouped();

    boxesOf(m)[3].click();
    await flush();
    expect(checkedOf(m)).toEqual([false, true, true, false]);

    boxesOf(m)[0].click();
    await flush();
    expect(checkedOf(m)).toEqual([true, true, true, true]);
    expect(codeOf(m).textContent).toBe(shownFor(app));

    boxesOf(m)[0].click();
    await flush();
    expect(checkedOf(m)).toEqual([false, false, false, false]);
  });

  it('starts a group added with every box checked checked, one added after unchecked, and drops a removed one', async () => {
    const { app, m } = await mountGrouped();
    const view = schemaSQLViewOf(app);

    app.store.dispatchSync(
      addTableGroupAction({ id: 'gc', ui: GROUP_UI }),
      changeTableGroupNameAction({ id: 'gc', value: 'Later' })
    );
    await flush();
    expect(labelsOf(m)).toEqual([
      'All',
      'Sales',
      'unnamed',
      'Later',
      'No group',
    ]);
    expect(checkedOf(m)).toEqual([true, true, true, true, true]);

    boxesOf(m)[1].click();
    await flush();
    app.store.dispatchSync(
      addTableGroupAction({ id: 'gd', ui: GROUP_UI }),
      changeTableGroupNameAction({ id: 'gd', value: 'Last' })
    );
    await flush();
    expect(checkedOf(m)).toEqual([false, false, true, true, false, true]);

    app.store.dispatchSync(removeTableGroupAction({ id: 'ga' }));
    await flush();
    expect(labelsOf(m)).toEqual([
      'All',
      'unnamed',
      'Later',
      'Last',
      'No group',
    ]);
    expect(view.tables).toEqual({
      groups: { gb: true, gc: true, gd: false },
      noGroup: true,
    });
    expect(codeOf(m).textContent).toBe(shownFor(app, ['t1', 't2', 't3', 't4']));
  });

  it('follows a group renamed while it shows, keeping its box', async () => {
    const { app, m } = await mountGrouped();

    boxesOf(m)[2].click();
    await flush();
    app.store.dispatchSync(
      changeTableGroupNameAction({ id: 'gb', value: 'Ops' })
    );
    await flush();

    expect(labelsOf(m)).toEqual(['All', 'Sales', 'Ops', 'No group']);
    expect(checkedOf(m)).toEqual([false, true, false, true]);
  });

  it('hides Tables and writes every table once the last group goes', async () => {
    const { app, m } = await mountGrouped();

    boxesOf(m)[3].click();
    await flush();
    app.store.dispatchSync(
      removeTableGroupAction({ id: 'ga' }),
      removeTableGroupAction({ id: 'gb' })
    );
    await flush();

    expect(tablesOf(m)).toBeNull();
    expect(codeOf(m).textContent).toBe(shownFor(app));
    expect(schemaSQLViewOf(app).tables).toEqual({ groups: {}, noGroup: true });
  });

  it('keeps the choice across a tab switch, a group added meanwhile starting unchecked', async () => {
    const { app, m } = await mountGrouped();

    boxesOf(m)[2].click();
    await flush();
    m.unmount();
    mounted = null;
    app.store.dispatchSync(addTableGroupAction({ id: 'gc', ui: GROUP_UI }));

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    expect(checkedOf(mounted)).toEqual([false, true, false, false, true]);
    expect(codeOf(mounted).textContent).toBe(shownFor(app, ['t1', 't2', 't4']));
  });

  it('chooses the same in a readonly editor, which dispatches nothing', async () => {
    const { app, m } = await mountGrouped(true);
    const dispatched = vi.fn();
    const unsubscribe = app.store.subscribe(dispatched);

    boxesOf(m)[1].click();
    await flush();

    expect(checkedOf(m)).toEqual([false, false, true, true]);
    expect(codeOf(m).textContent).toBe(shownFor(app, ['t3', 't4']));
    expect(dispatched).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("leaves one table's create to Table Properties whatever is checked", async () => {
    const app = createApp();
    seedGroups(app);
    schemaSQLViewOf(app).tables = {
      groups: { ga: false, gb: false },
      noGroup: false,
    };
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} tableId=${'t1'} />`,
      app
    );

    expect(codeOf(mounted).textContent).toContain('CREATE TABLE users');
    expect(codeOf(mounted).textContent).not.toContain('SET a;');
    expect(mounted.container.querySelector('.schema-sql-no-table')).toBeNull();
  });
});
