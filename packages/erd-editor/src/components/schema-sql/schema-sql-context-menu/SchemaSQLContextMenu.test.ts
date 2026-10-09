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
import { AppContext } from '@/components/appContext';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import SchemaSQLContextMenu from '@/components/schema-sql/schema-sql-context-menu/SchemaSQLContextMenu';
import { schemaSQLViewOf } from '@/components/schema-sql/schemaSQLView';
import { BracketType, Database } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { changeDatabaseAction } from '@/engine/modules/settings/atom.actions';
import { createI18n } from '@/i18n/translate';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

type Api = ReturnType<typeof useContextMenuRootProvider>;
type HostProps = {
  onClose: () => void;
  full?: boolean;
  onSave?: () => void;
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
      <div class="host">
        <${SchemaSQLContextMenu}
          .onClose=${props.onClose}
          .full=${props.full}
          .onSave=${props.onSave}
        />
      </div>
    `;
  };

  return { Host, getApi: () => api as Api };
}

async function open(
  onClose: () => void = () => {},
  app?: AppContext,
  full = false,
  onSave?: () => void
) {
  const { Host, getApi } = createHost();
  mounted = await mountAndFlush(
    html`<${Host} .onClose=${onClose} .full=${full} .onSave=${onSave} />`,
    app
  );
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

  it('names its entries and None in the language the element shows, the rest as written', async () => {
    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);

    try {
      await open();
      Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
      await flush();

      expect(topItems().map(el => el.textContent?.trim())).toEqual([
        'ko:Database',
        'ko:Bracket',
      ]);
      const brackets = await openSubmenu('ko:Bracket');
      expect(subItems(brackets).map(el => el.textContent?.trim())).toEqual([
        'SingleQuote',
        'DoubleQuote',
        'Backtick',
        'ko:None',
      ]);
      const vendors = await openSubmenu('ko:Database');
      expect(subItems(vendors).map(el => el.textContent?.trim())).toContain(
        'PostgreSQL'
      );
    } finally {
      provider.destroy();
    }
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

  it("leaves the Schema SQL tab's panel unsettled, for that tab to open by its own width", async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(changeViewportAction({ width: 600, height: 800 }));
    await open(() => {}, app);

    expect(schemaSQLViewOf(app).panel).toBe('unset');
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

describe('SchemaSQLContextMenu for the whole document', () => {
  const click = (el: HTMLElement) =>
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  const rows = (content: HTMLElement) =>
    subItems(content).map(el => ({
      name: el.textContent?.replace(/not in \w+$/, '').trim(),
      checked: el.querySelector('svg') !== null,
      note: el.textContent?.match(/not in \w+$/)?.[0] ?? null,
    }));

  it('adds Statements, Header, Options panel and Save file after Database and Bracket', async () => {
    await open(() => {}, undefined, true);

    expect(topItems().map(el => el.textContent?.trim())).toEqual([
      'Database',
      'Bracket',
      'Statements',
      'Header',
      'Options panel',
      'Save file…',
    ]);
  });

  it('lists the statements, the one the database writes checked and one it lacks noted', async () => {
    const app = createTestAppContext();
    await open(() => {}, app, true);

    expect(rows(await openSubmenu('Statements'))).toEqual([
      { name: 'Create', checked: false, note: null },
      { name: 'If not exists', checked: true, note: null },
      { name: 'Drop & re-create', checked: false, note: null },
    ]);

    app.store.dispatchSync(changeDatabaseAction({ value: Database.Oracle }));
    await flush();

    expect(rows(await openSubmenu('Statements'))).toEqual([
      { name: 'Create', checked: true, note: null },
      { name: 'If not exists', checked: false, note: 'not in Oracle' },
      { name: 'Drop & re-create', checked: false, note: null },
    ]);
  });

  it('keeps a pick for the window and the menu open, and an inert row inert', async () => {
    const app = createTestAppContext();
    const onClose = vi.fn();
    app.store.dispatchSync(changeDatabaseAction({ value: Database.MSSQL }));
    await open(onClose, app, true);
    const view = schemaSQLViewOf(app);
    view.statements = 'create';

    const statements = subItems(await openSubmenu('Statements'));
    click(statements[1]);
    expect(view.statements).toBe('create');

    click(statements[2]);
    await flush();
    expect(view.statements).toBe('recreate');
    expect(onClose).not.toHaveBeenCalled();
    expect(rootContent()).toBeTruthy();
  });

  it("lists None in the reader's language and the two headers as SQL, by the same rules", async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      changeDatabaseAction({ value: Database.PostgreSQL })
    );
    await open(() => {}, app, true);

    const content = await openSubmenu('Header');
    expect(rows(content)).toEqual([
      { name: 'None', checked: false, note: null },
      { name: 'USE', checked: false, note: 'not in PostgreSQL' },
      { name: 'CREATE + USE', checked: true, note: null },
    ]);
    expect(
      subItems(content).map(el => el.querySelector('[dir="ltr"]') !== null)
    ).toEqual([false, true, true]);

    click(subItems(content)[0]);
    expect(schemaSQLViewOf(app).header).toBe('none');
  });

  it('checks Options panel while the panel is out, and toggles it, closing the menu', async () => {
    const app = createTestAppContext();
    const onClose = vi.fn();
    await open(onClose, app, true);

    const panel = topItemByName('Options panel');
    expect(panel.querySelector('svg')).not.toBeNull();

    click(panel);

    expect(schemaSQLViewOf(app).panel).toBe('closed');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('saves the file from Save file…, closing the menu', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    await open(onClose, undefined, true, onSave);

    click(topItemByName('Save file…'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("names the rows in the reader's language, the statements and headers as written", async () => {
    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);

    try {
      await open(() => {}, undefined, true);
      Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
      await flush();

      expect(
        topItems()
          .map(el => el.textContent?.trim())
          .slice(2)
      ).toEqual([
        'ko:Statements',
        'ko:Header',
        'ko:Options panel',
        'ko:Save file…',
      ]);
      expect(
        subItems(await openSubmenu('ko:Statements')).map(el =>
          el.textContent?.trim()
        )
      ).toEqual(['Create', 'If not exists', 'Drop & re-create']);
    } finally {
      provider.destroy();
    }
  });
});
