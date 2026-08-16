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
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import SchemaSQL from '@/components/schema-sql/SchemaSQL';
import { BracketType, Database } from '@/constants/schema';
import {
  changeBracketTypeAction,
  changeDatabaseAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import {
  setGetShikiServiceCallback,
  ShikiService,
} from '@/services/shikiService';
import { openToastAction } from '@/utils/emitter';

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard'
);

let mounted: Mounted | null = null;

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
  mounted?.unmount();
  mounted = null;
  setGetShikiServiceCallback(() => null);

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
    const app = createTestAppContext();
    seedTable(app, 't1', 'users');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    expect(codeOf(mounted).textContent).toContain('CREATE TABLE users');
  });

  it('renders an empty schema when the document has no tables', async () => {
    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${false} />`);

    expect(codeOf(mounted).textContent).not.toContain('CREATE TABLE');
  });

  it('renders only the requested table when tableId is given', async () => {
    const app = createTestAppContext();
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
    const app = createTestAppContext();
    seedTable(app, 't1', 'users');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} tableId=${'nope'} />`,
      app
    );

    expect(codeOf(mounted).textContent).toBe('');
  });

  it('passes the dark theme to the code block when isDarkMode is true', async () => {
    const codeToHtml = createCodeToHtml();
    setGetShikiServiceCallback(
      () => ({ codeToHtml }) as unknown as ShikiService
    );

    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${true} />`);

    expect(codeToHtml.mock.calls.at(-1)?.[1]).toEqual({
      lang: 'sql',
      theme: 'dark',
    });
  });

  it('passes the light theme to the code block when isDarkMode is false', async () => {
    const codeToHtml = createCodeToHtml();
    setGetShikiServiceCallback(
      () => ({ codeToHtml }) as unknown as ShikiService
    );

    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${false} />`);

    expect(codeToHtml.mock.calls.at(-1)?.[1]).toEqual({
      lang: 'sql',
      theme: 'light',
    });
  });

  it('regenerates the sql when the database setting changes', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 'users');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );
    expect(codeOf(mounted).textContent).toContain('CREATE TABLE users');

    app.store.dispatchSync(
      changeTableNameAction({ id: 't1', value: 'accounts' }),
      changeDatabaseAction({ value: Database.PostgreSQL })
    );
    await flush();

    expect(codeOf(mounted).textContent).toContain('CREATE TABLE accounts');
    expect(app.store.state.settings.database).toBe(Database.PostgreSQL);
  });

  it('regenerates the sql when the bracket type setting changes', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 'users');

    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );
    expect(codeOf(mounted).textContent).toContain('CREATE TABLE users');

    app.store.dispatchSync(
      changeBracketTypeAction({ value: BracketType.backtick })
    );
    await flush();

    expect(codeOf(mounted).textContent).toContain('CREATE TABLE `users`');
  });

  it('ignores settings changes that cannot affect the sql', async () => {
    const app = createTestAppContext();
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
    const app = createTestAppContext();
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
    const app = createTestAppContext();
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

    rootOf(mounted).dispatchEvent(
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
    rootOf(mounted).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('closes the context menu on a mousedown outside the menu content', async () => {
    mounted = await mountAndFlush(html`<${SchemaSQL} isDarkMode=${false} />`);

    rootOf(mounted).dispatchEvent(
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

    rootOf(mounted).dispatchEvent(
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
    const app = createTestAppContext();
    mounted = await mountAndFlush(
      html`<${SchemaSQL} isDarkMode=${false} />`,
      app
    );

    rootOf(mounted).dispatchEvent(
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
    const app = createTestAppContext();
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
    expect(writeText.mock.calls[0][0]).toContain('CREATE TABLE users');

    expect(openToast).toHaveBeenCalledTimes(1);
    const action = openToast.mock.calls[0][0];
    expect(action.type).toBe(openToastAction({} as any).type);
    expect(action.payload.message).toBeTruthy();
    expect(action.payload.close).toBeInstanceOf(Promise);
  });

  it('stops reacting to store changes after unmount', async () => {
    const app = createTestAppContext();
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
});
