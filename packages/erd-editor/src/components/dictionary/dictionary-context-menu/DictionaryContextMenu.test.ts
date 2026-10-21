import { FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
} from '@/__test-utils__/index';
import DictionaryContextMenu, {
  type DictionaryContextMenuProps,
} from '@/components/dictionary/dictionary-context-menu/DictionaryContextMenu';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { messagesOf } from '@/i18n/messages/index';
import { createI18n } from '@/i18n/translate';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** Mounts the menu under a root context menu provider, opened. */
async function open(props: DictionaryContextMenuProps) {
  let api: ReturnType<typeof useContextMenuRootProvider> | null = null;

  const Host: FC<DictionaryContextMenuProps> = (hostProps, ctx) => {
    api = useContextMenuRootProvider(ctx);

    return () => html` <${DictionaryContextMenu} ...${hostProps} /> `;
  };

  mounted = await mountAndFlush(html`<${Host} ...${props} />`);
  api!.state.show = true;
  await flush();
}

const rows = () =>
  Array.from(
    (mounted as Mounted).container.querySelectorAll(
      '.context-menu-content[data-id="root"] > [data-id]'
    )
  ) as HTMLElement[];

const handlers = () => ({
  column: 'Word',
  onInsertAbove: vi.fn(),
  onInsertBelow: vi.fn(),
  onDeleteRows: vi.fn(),
  onSortAscending: vi.fn(),
  onSortDescending: vi.fn(),
  onImport: vi.fn(),
  onExport: vi.fn(),
});

describe('DictionaryContextMenu', () => {
  it('names the rows it inserts and deletes by the count, the sorts by the column and the file rows by CSV, a rule between the groups', async () => {
    await open({ count: 1, ...handlers() });

    expect(rows().map(row => row.textContent?.trim())).toEqual([
      'Insert 1 row above',
      'Insert 1 row below',
      'Delete 1 row',
      'Sort by Word, ascending',
      'Sort by Word, descending',
      'Import CSV',
      'Export CSV',
    ]);
    expect(
      (mounted as Mounted).container.querySelectorAll('[role="separator"]')
    ).toHaveLength(2);
  });

  it('runs the handler of the row pressed', async () => {
    const spies = handlers();
    await open({ count: 3, ...spies });

    expect(rows()[0].textContent?.trim()).toBe('Insert 3 rows above');
    rows().forEach(row => row.click());

    for (const spy of Object.values(spies)) {
      if (typeof spy === 'function') expect(spy).toHaveBeenCalledTimes(1);
    }
  });

  it('counts the rows in the plural form of the language shown', async () => {
    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);

    try {
      await open({ count: 5, ...handlers() });
      Object.assign(i18n, createI18n('ru-RU', messagesOf('ru-RU')));
      await flush();

      expect(rows().map(row => row.textContent?.trim())).toEqual([
        'Вставить 5 строк выше',
        'Вставить 5 строк ниже',
        'Удалить 5 строк',
        'Сортировка по возрастанию: Word',
        'Сортировка по убыванию: Word',
        'Импорт CSV',
        'Экспорт CSV',
      ]);
    } finally {
      provider.destroy();
    }
  });
});
