import { FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import SchemaSQLContextMenu from '@/components/schema-sql/schema-sql-context-menu/SchemaSQLContextMenu';
import { BracketType, Database } from '@/constants/schema';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

type Api = ReturnType<typeof useContextMenuRootProvider>;
type HostProps = { onClose: () => void };

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
      <div class="host">
        <${SchemaSQLContextMenu} .onClose=${props.onClose} />
      </div>
    `;
  };

  return { Host, getApi: () => api as Api };
}

async function open(onClose: () => void = () => {}, app?: AppContext) {
  const { Host, getApi } = createHost();
  mounted = await mountAndFlush(html`<${Host} .onClose=${onClose} />`, app);
  getApi().state.show = true;
  await flush();
  return { getApi };
}

const rootContent = () =>
  (mounted as Mounted).container.querySelector(
    '.context-menu-content[data-id="root"]'
  ) as HTMLElement;

const topItems = () =>
  Array.from(rootContent().children).filter(
    el => !el.classList.contains('context-menu-content')
  ) as HTMLElement[];

const topItemByName = (name: string) =>
  topItems().find(el => el.textContent?.includes(name)) as HTMLElement;

const subContentOf = (item: HTMLElement) =>
  (mounted as Mounted).container.querySelector(
    `.context-menu-content[data-id="${item.dataset.id}"]`
  ) as HTMLElement | null;

async function openSubmenu(name: string) {
  const item = topItemByName(name);
  item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  await flush();
  return subContentOf(item) as HTMLElement;
}

const subItems = (content: HTMLElement) =>
  Array.from(content.children).filter(
    el => !el.classList.contains('context-menu-content')
  ) as HTMLElement[];

describe('SchemaSQLContextMenu', () => {
  it('renders nothing while the root context menu is closed', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(html`<${Host} .onClose=${() => {}} />`);

    expect(mounted.container.querySelector('.context-menu-content')).toBeNull();
  });

  it('renders the Database and Bracket entries once opened', async () => {
    await open();

    expect(rootContent()).toBeTruthy();
    expect(topItems()).toHaveLength(2);
    expect(topItems().map(el => el.textContent?.trim())).toEqual([
      'Database',
      'Bracket',
    ]);
  });

  it('gives both top level entries an icon and a chevron affordance', async () => {
    await open();

    topItems().forEach(item => {
      expect(item.querySelectorAll('svg').length).toBe(2);
    });
  });

  it('does not render submenus until the entry is hovered', async () => {
    await open();

    expect(subContentOf(topItemByName('Bracket'))).toBeNull();
    expect(subContentOf(topItemByName('Database'))).toBeNull();
  });

  it('opens the bracket submenu with every bracket option on mouseenter', async () => {
    await open();

    const content = await openSubmenu('Bracket');

    expect(content).toBeTruthy();
    expect(subItems(content).map(el => el.textContent?.trim())).toEqual([
      'SingleQuote',
      'DoubleQuote',
      'Backtick',
      'None',
    ]);
  });

  it('opens the database submenu with every supported vendor', async () => {
    await open();

    const content = await openSubmenu('Database');

    expect(subItems(content).map(el => el.textContent?.trim())).toEqual([
      'Databricks',
      'MSSQL',
      'MariaDB',
      'MySQL',
      'Oracle',
      'PostgreSQL',
      'Snowflake',
      'SQLite',
    ]);
  });

  it('marks only the active bracket option with a check icon', async () => {
    await open();

    const items = subItems(await openSubmenu('Bracket'));

    expect(items.map(el => el.querySelectorAll('svg').length)).toEqual([
      0, 0, 0, 1,
    ]);
  });

  it('marks only the active database with a check icon', async () => {
    await open();

    const items = subItems(await openSubmenu('Database'));

    expect(items.map(el => el.querySelectorAll('svg').length)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 0,
    ]);
  });

  it('dispatches the bracket change when a bracket option is clicked', async () => {
    const app = createTestAppContext();
    await open(() => {}, app);

    const items = subItems(await openSubmenu('Bracket'));
    items[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(app.store.state.settings.bracketType).toBe(BracketType.backtick);
  });

  it('dispatches the database change when a vendor is clicked', async () => {
    const app = createTestAppContext();
    await open(() => {}, app);

    const items = subItems(await openSubmenu('Database'));
    items[5].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(app.store.state.settings.database).toBe(Database.PostgreSQL);
  });

  it('closes the previously opened submenu when the sibling entry is hovered', async () => {
    await open();

    const database = topItemByName('Database');
    await openSubmenu('Database');
    expect(subContentOf(database)).toBeTruthy();

    await openSubmenu('Bracket');

    expect(subContentOf(database)).toBeNull();
    expect(subContentOf(topItemByName('Bracket'))).toBeTruthy();
  });

  it('calls onClose when the stop shortcut fires', async () => {
    const onClose = vi.fn();
    const app = createTestAppContext();
    await open(onClose, app);

    app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts other than stop', async () => {
    const onClose = vi.fn();
    const app = createTestAppContext();
    await open(onClose, app);

    app.shortcut$.next({
      type: KeyBindingName.addTable,
      event: new KeyboardEvent('keydown', { key: 'n' }),
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps listening for the stop shortcut while only the root content closes', async () => {
    const onClose = vi.fn();
    const app = createTestAppContext();
    const { getApi } = await open(onClose, app);

    getApi().state.show = false;
    await flush();
    expect(
      (mounted as Mounted).container.querySelector('.context-menu-content')
    ).toBeNull();

    app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from the shortcut stream once it unmounts', async () => {
    const onClose = vi.fn();
    const app = createTestAppContext();
    await open(onClose, app);

    (mounted as Mounted).unmount();
    mounted = null;

    app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
