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
import GeneratorCode from '@/components/generator-code/GeneratorCode';
import * as styles from '@/components/generator-code/GeneratorCode.styles';
import { Language, NameCase } from '@/constants/schema';
import {
  changeColumnNameCaseAction,
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
import {
  setGetShikiServiceCallback,
  ShikiService,
} from '@/services/shikiService';
import {
  createGeneratorCode,
  createGeneratorCodeTable,
} from '@/utils/generator-code';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

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
  rootOf(m).dispatchEvent(event);
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
  mounted?.unmount();
  mounted = null;
  setGetShikiServiceCallback(() => null);

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

  it('regenerates for the language setting and passes the mapped lang to the code block', async () => {
    const app = createSeededApp();
    const { service, codeToHtml } = createShikiService();
    setGetShikiServiceCallback(() => service);

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
    setGetShikiServiceCallback(() => service);

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
    setGetShikiServiceCallback(() => service);

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
});
