import { FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import GeneratorCodeContextMenu from '@/components/generator-code/generator-code-context-menu/GeneratorCodeContextMenu';
import * as itemStyles from '@/components/primitives/context-menu/context-menu-item/ContextMenuItem.styles';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { Language, NameCase } from '@/constants/schema';
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
      <${GeneratorCodeContextMenu} .onClose=${props.onClose} />
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

async function openMenu(onClose: () => void = () => {}) {
  const { Host, getApi } = createHost();
  const app = createTestAppContext();
  mounted = await mountAndFlush(html`<${Host} .onClose=${onClose} />`, app);

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

  it('renders the three generator settings entries once the root opens', async () => {
    await openMenu();

    const [root] = contentsOf(mounted as Mounted);
    expect(root.dataset.id).toBe('root');
    expect(namesOf(root)).toEqual([
      'Language',
      'Table Name Case',
      'Column Name Case',
    ]);
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
      'GraphQL',
      'C#',
      'Java',
      'Kotlin',
      'TypeScript',
      'JPA',
      'Scala',
      'Go',
      'SQLAlchemy',
      'TypeORM',
      'Sequelize',
      'Drizzle',
      'DBML',
      'AML',
    ]);
    expect(checkedNameOf(submenu)).toEqual(['GraphQL']);
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
