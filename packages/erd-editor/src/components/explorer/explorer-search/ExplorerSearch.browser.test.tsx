// The Explorer's search in a real Chromium: its fields and tools, the keys it
// answers, where the keyboard goes, and the tree it turns the Explorer into.

import { addCSSHost } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  flush,
  mount,
  type Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__';
import { openSearchOn } from '@/__test-utils__/explorerSearch';
import { seedFindDocument } from '@/__test-utils__/findSeed';
import { iconNameOf } from '@/__test-utils__/icon';
import type { AppContext } from '@/components/appContext';
import {
  measureRoot,
  observeViewport,
} from '@/components/erd-editor/viewportLayout';
import Explorer from '@/components/explorer/Explorer';
import ExplorerController from '@/components/explorer/explorer-controller/ExplorerController';
import { closeExplorer } from '@/components/explorer/explorerCommands';
import { focusSearch } from '@/components/explorer/explorerSearch';
import { explorerViewOf } from '@/components/explorer/explorerView';
import { NameViewMode } from '@/constants/schema';
import { toNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import { changeTableLogicalNameAction } from '@/engine/modules/table/atom.actions';
import type { I18n } from '@/i18n/translate';
import { hasAppleDevice } from '@/utils/device-detect';
import { DEFAULT_FIND_FIELDS, FindFieldList } from '@/utils/find-replace';
import { InternalEventType } from '@/utils/internalEvents';

/** The modifier $mod stands for where the spec runs. */
const MOD: KeyboardEventInit = hasAppleDevice()
  ? { metaKey: true }
  : { ctrlKey: true };

let app: AppContext;
let mounted: Mounted | null = null;
let shadowHost: HTMLElement | null = null;
let stopObserving = () => {};
let forced = 0;
/** Every keydown that got past the panel to the element around it. */
let escaped: KeyboardEvent[] = [];

async function setup({
  readonly = false,
  i18n,
}: { readonly?: boolean; i18n?: I18n } = {}) {
  app = createTestAppContext();
  seedFindDocument(app);
  stopObserving = observeViewport(app.store);
  measureRoot(app.store, { width: 1200, height: 600 });

  shadowHost = document.createElement('div');
  document.body.append(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const scope = document.createElement('div');
  shadow.append(scope);
  i18n && provideI18n(scope, i18n);
  shadowHost.addEventListener(InternalEventType.forceFocus, () => forced++);

  mounted = mount(
    <div class="frame" style={{ display: 'flex', height: '600px' }}>
      <ExplorerController />
      <Explorer readonly={readonly} />
    </div>,
    app,
    scope
  );
  const frame = mounted.container.querySelector('.frame') as HTMLElement;
  frame.addEventListener('keydown', event => escaped.push(event));
  await settle();
}

async function settle() {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await flush();
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  shadowHost?.remove();
  shadowHost = null;
  stopObserving();
  app.store.destroy();
  forced = 0;
  escaped = [];
});

const panel = () =>
  mounted!.container.querySelector('.explorer') as HTMLElement | null;
const search = () =>
  panel()!.querySelector('.explorer-search') as HTMLElement | null;
const tool = (name: string) =>
  panel()?.querySelector<HTMLButtonElement>(`.${name}`) ?? null;
const findInput = () =>
  panel()!.querySelector('.find-input') as HTMLInputElement;
const replaceInput = () =>
  panel()?.querySelector<HTMLInputElement>('.replace-input') ?? null;
const countText = () =>
  panel()!.querySelector('.find-count')!.textContent!.trim();
const rows = () =>
  Array.from(panel()!.querySelectorAll<HTMLElement>('[role="treeitem"]'));
const rowIds = () => rows().map(row => row.id.replace(/^tree-\d+:/, ''));
const rowOf = (nodeId: string) =>
  rows().find(row => row.id.endsWith(`:${nodeId}`)) as HTMLElement;
const marksOf = (nodeId: string) =>
  Array.from(rowOf(nodeId).querySelectorAll('mark')).map(
    mark => mark.textContent
  );
const activeElement = () => shadowHost!.shadowRoot!.activeElement;

const open = async (query?: string) => {
  openSearchOn(app, query);
  await settle();
};

const type = async (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await settle();
};

const press = async (
  target: HTMLElement,
  key: string,
  init: KeyboardEventInit = {}
) => {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  await settle();
  return event;
};

const click = async (element: HTMLElement) => {
  element.click();
  await settle();
};

describe('ExplorerSearch - layout', () => {
  it('stands between the header and the tree: the find field with its three options, the count with its steps and the three dots (AC-Q1)', async () => {
    await setup();
    await open();

    const children = Array.from(panel()!.children);
    expect(children.indexOf(search()!)).toBe(1);
    expect(
      search()!.nextElementSibling?.querySelector('[role="tree"]')
    ).not.toBeNull();

    const field = findInput().parentElement!;
    expect(
      Array.from(field.querySelectorAll('button')).map(button =>
        iconNameOf(button)
      )
    ).toEqual(['case-sensitive', 'whole-word', 'regex']);
    for (const name of [
      'find-count',
      'find-previous',
      'find-next',
      'find-scopes-toggle',
    ]) {
      expect(tool(name) ?? panel()!.querySelector(`.${name}`)).not.toBeNull();
    }
    expect(iconNameOf(tool('find-scopes-toggle')!)).toBe('ellipsis');
    expect(panel()!.querySelectorAll('.find-scope')).toHaveLength(0);
  });

  it('folds the Replace row away to begin with and unfolds it on its arrow, with Preserve Case, Replace and Replace All (AC-R1)', async () => {
    await setup();
    await open();
    const toggle = tool('explorer-replace-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(iconNameOf(toggle)).toBe('chevron-right');
    expect(replaceInput()).toBeNull();

    await click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(iconNameOf(toggle)).toBe('chevron-down');
    expect(replaceInput()).not.toBeNull();
    expect(iconNameOf(tool('find-preserve-case')!)).toBe('case-upper');
    expect(replaceInput()!.parentElement).toBe(
      tool('find-preserve-case')!.parentElement
    );
    expect(iconNameOf(tool('find-replace-one')!)).toBe('replace');
    expect(iconNameOf(tool('find-replace-all')!)).toBe('replace-all');
  });

  it('stands its arrow as tall as the rows it unfolds, the Replace row included', async () => {
    await setup();
    await open();
    const toggle = tool('explorer-replace-toggle')!;
    const findField = findInput().parentElement!;
    expect(toggle.getBoundingClientRect().height).toBe(
      findField.getBoundingClientRect().height
    );

    await click(toggle);

    const top = findField.getBoundingClientRect().top;
    const bottom =
      replaceInput()!.parentElement!.getBoundingClientRect().bottom;
    expect(toggle.getBoundingClientRect().top).toBe(top);
    expect(toggle.getBoundingClientRect().bottom).toBe(bottom);
  });

  it('shows the eight kinds of text past the three dots, the names alone pressed at first (AC-Q2)', async () => {
    await setup();
    await open();

    await click(tool('find-scopes-toggle')!);

    const chips = Array.from(
      panel()!.querySelectorAll<HTMLButtonElement>('.find-scope')
    );
    expect(chips.map(chip => chip.dataset.field)).toEqual(FindFieldList);
    expect(
      chips
        .filter(chip => chip.getAttribute('aria-pressed') === 'true')
        .map(chip => chip.dataset.field)
    ).toEqual(DEFAULT_FIND_FIELDS);

    await click(chips[1]);
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the Replace row and the scopes unfolded as they were left', async () => {
    await setup();
    await open();
    await click(tool('explorer-replace-toggle')!);
    await click(tool('find-scopes-toggle')!);
    closeExplorer(app.store);
    await settle();

    await open();

    expect(replaceInput()).not.toBeNull();
    expect(panel()!.querySelectorAll('.find-scope')).toHaveLength(8);
  });

  it('offers nothing to replace with in a read-only editor', async () => {
    await setup({ readonly: true });
    explorerViewOf(app.store).replaceOpen = true;
    await open('user');

    expect(tool('explorer-replace-toggle')).toBeNull();
    expect(replaceInput()).toBeNull();
    expect(tool('find-replace-all')).toBeNull();

    await press(findInput(), 'Enter');
    expect(countText()).toBe('1 of 5');
  });

  it('presses its options, steps and replace buttons, each showing pressed while on', async () => {
    await setup();
    await open('user');
    await click(tool('explorer-replace-toggle')!);

    for (const name of [
      'find-match-case',
      'find-whole-word',
      'find-regex',
      'find-preserve-case',
    ]) {
      await click(tool(name)!);
      expect(tool(name)!.getAttribute('aria-pressed')).toBe('true');
      await click(tool(name)!);
      expect(tool(name)!.getAttribute('aria-pressed')).toBe('false');
    }

    await click(tool('find-next')!);
    expect(countText()).toBe('1 of 5');
    await click(tool('find-previous')!);
    expect(countText()).toBe('5 of 5');

    await type(replaceInput()!, 'member');
    await click(tool('find-replace-one')!);
    expect(app.store.state.collections.memoEntities.note.value).toBe(
      'Every user_id points at members.id'
    );
    await click(tool('find-replace-all')!);
    expect(countText()).toBe('Replaced 4 matches');
  });

  it('disables both replace buttons without a match, and the steps too', async () => {
    await setup();
    await open('nothing like it');
    await click(tool('explorer-replace-toggle')!);

    expect(tool('find-replace-one')!.disabled).toBe(true);
    expect(tool('find-replace-all')!.disabled).toBe(true);
    expect(tool('find-next')!.disabled).toBe(true);
    expect(countText()).toBe('No results');
  });
});

describe('ExplorerSearch - keyboard', () => {
  it('takes the keyboard on an opening, and back on an opening with no query while shown, its query selected (AC-S20)', async () => {
    await setup();
    await open();
    expect(activeElement()).toBe(findInput());

    await type(findInput(), 'user');
    await press(findInput(), 'Enter');
    tool('find-next')!.focus();

    await open();

    expect(activeElement()).toBe(findInput());
    expect(findInput().selectionStart).toBe(0);
    expect(findInput().selectionEnd).toBe('user'.length);
    expect(countText()).toBe('1 of 2');
  });

  it('lets go of a request no drawn panel took, so a panel drawn later takes no keyboard', async () => {
    await setup();
    measureRoot(app.store, { width: 500, height: 600 });
    await open('user');
    expect(panel()).toBeNull();
    const before = activeElement();
    focusSearch(app.store);
    expect(explorerViewOf(app.store).focusRequest).toBeGreaterThan(0);
    await settle();

    measureRoot(app.store, { width: 1200, height: 600 });
    await settle();

    expect(panel()).not.toBeNull();
    expect(activeElement()).toBe(before);
  });

  it('goes through the matches on Enter and Shift+Enter, the tree on the current row (AC-Q6)', async () => {
    await setup();
    await open('user');

    const event = await press(findInput(), 'Enter');

    expect(event.defaultPrevented).toBe(true);
    expect(countText()).toBe('1 of 5');
    expect(rowOf('c:orders_user_id').getAttribute('aria-current')).toBe('true');
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'orders',
      columnId: 'orders_user_id',
    });

    await press(findInput(), 'Enter', { shiftKey: true });
    await press(findInput(), 'Enter', { shiftKey: true });

    expect(countText()).toBe('4 of 5');
    expect(rowOf('m:note/x:memo:6').getAttribute('aria-current')).toBe('true');
    expect(rowOf('c:orders_user_id').getAttribute('aria-current')).toBeNull();
  });

  it('leaves Enter mid-composition to the input method', async () => {
    await setup();
    await open('user');

    const event = await press(findInput(), 'Enter', { isComposing: true });

    expect(event.defaultPrevented).toBe(false);
    expect(countText()).toBe('5 matches');
  });

  it('replaces on Enter in the Replace field and every match on $mod+Enter', async () => {
    await setup();
    await open('user');
    await click(tool('explorer-replace-toggle')!);
    await type(replaceInput()!, 'member');
    await press(findInput(), 'Enter');

    await press(replaceInput()!, 'Enter');
    expect(
      app.store.state.collections.tableColumnEntities.orders_user_id.name
    ).toBe('member_id');

    await press(replaceInput()!, 'Enter', MOD);
    expect(app.store.state.collections.tableEntities.users.name).toBe(
      'members'
    );
    expect(countText()).toBe('Replaced 4 matches');
  });

  it('hands the keyboard to the canvas on Escape and stays open', async () => {
    await setup();
    await open('user');

    const event = await press(findInput(), 'Escape');

    expect(event.defaultPrevented).toBe(true);
    expect(forced).toBe(1);
    expect(panel()).not.toBeNull();
    expect(escaped).toEqual([]);
  });

  it('keeps from the canvas what it would read as an edit, and lets undo, the find chord and the host through', async () => {
    await setup();
    await open('user');

    for (const key of [
      'Enter',
      'ArrowLeft',
      'Backspace',
      'Delete',
      'Tab',
      ' ',
    ]) {
      await press(findInput(), key);
    }
    expect(escaped).toEqual([]);

    await press(findInput(), 'z', MOD);
    await press(findInput(), 'f', MOD);
    await press(findInput(), 's', { metaKey: true });

    expect(escaped.map(({ code }) => code)).toEqual(['KeyZ', 'KeyF', 'KeyS']);
    expect(escaped[2].defaultPrevented).toBe(false);
  });
});

describe('ExplorerSearch - the tree it searches', () => {
  it('shows the matches and the rows above them alone, a name marked on its row and a comment or memo by its excerpt (AC-Q3)', async () => {
    await setup();
    await open('user');

    expect(rowIds()).toEqual([
      'f:tables',
      't:orders',
      't:orders/f:columns',
      'c:orders_user_id',
      't:users',
      't:users/f:columns',
      'c:users_id',
      'c:users_id/x:columnComment:0',
      'f:memos',
      'm:note',
      'm:note/x:memo:6',
      'm:note/x:memo:24',
    ]);
    expect(marksOf('t:orders')).toEqual([]);
    expect(marksOf('c:orders_user_id')).toEqual(['user']);
    expect(marksOf('t:users')).toEqual(['user']);
    expect(marksOf('m:note/x:memo:24')).toEqual(['user']);
    expect(rowOf('m:note/x:memo:24').textContent?.trim()).toBe(
      'Every user_id points at users.id'
    );
    expect(rowOf('f:tables').textContent?.trim()).toBe('Tables2');
  });

  it('marks a logical name where the name view draws it, and the name apart from it', async () => {
    await setup();
    app.store.dispatchSync(
      changeTableLogicalNameAction({ id: 'users', value: 'users' }),
      changeTableLogicalNameAction({ id: 'orders', value: 'User Orders' })
    );
    await open('user');
    const view = async (
      mode: (typeof NameViewMode)[keyof typeof NameViewMode]
    ) => {
      app.store.dispatchSync(
        toNameViewModeAction(app.store.state, mode, false)
      );
      await settle();
    };

    expect(rowIds().slice(0, 2)).toEqual(['f:tables', 't:orders']);
    expect(marksOf('t:orders')).toEqual([]);
    expect(marksOf('t:users')).toEqual(['user']);

    await view(NameViewMode.both);
    expect(marksOf('t:orders')).toEqual(['User']);
    expect(rowOf('t:users').textContent?.trim()).toBe('usersusers');
    expect(marksOf('t:users')).toEqual(['user', 'user']);

    await view(NameViewMode.logical);
    expect(rowOf('t:orders').textContent?.trim()).toBe('User Orders');
    expect(marksOf('t:orders')).toEqual(['User']);
    expect(marksOf('t:users')).toEqual(['user']);
  });

  it('goes to the match a row holds on a click, the first of a name, and where any other row stands for', async () => {
    await setup();
    await open('user');

    await click(rowOf('m:note/x:memo:24'));
    expect(countText()).toBe('5 of 5');
    expect(app.store.state.editor.selectedMap).toEqual({ note: 'memo' });

    await click(rowOf('t:users'));
    expect(countText()).toBe('2 of 5');

    await click(rowOf('t:orders'));
    expect(countText()).toBe('2 of 5');
    expect(app.store.state.editor.selectedMap).toEqual({ orders: 'table' });
  });

  it('folds a row for this search alone, and gives back the folding it had once the query is cleared (AC-Q10)', async () => {
    await setup();
    await open();
    const expanded = explorerViewOf(app.store).expanded;
    await type(findInput(), 'user');

    await click(rowOf('t:orders').querySelector('.tree-twisty') as HTMLElement);
    expect(rowIds()).not.toContain('c:orders_user_id');

    (panel()!.querySelector('.explorer-collapse-all') as HTMLElement).click();
    await settle();
    // An opening with no query searches the names alone, so no memo shows.
    expect(rowIds()).toEqual(['f:tables']);

    await type(findInput(), '');

    expect(explorerViewOf(app.store).expanded).toBe(expanded);
    expect(rowIds()).toEqual(['f:tables', 't:orders', 't:users', 'f:memos']);
  });

  it('lets each excerpt and what is typed take their own direction, the empty Replace field the page', async () => {
    await setup();
    await open('user');
    await click(tool('explorer-replace-toggle')!);

    expect(
      rowOf('m:note/x:memo:6').querySelector('span[dir]')?.getAttribute('dir')
    ).toBe('auto');
    expect(findInput().getAttribute('dir')).toBe('auto');
    expect(replaceInput()!.getAttribute('dir')).toBe('');
  });
});

describe('ExplorerSearch - in the language the editor shows', () => {
  it('names its tools in the language provided', async () => {
    await setup({ i18n: createTestI18n('de-DE', pseudoMessages('de')) });
    await open();
    await click(tool('explorer-replace-toggle')!);

    expect(findInput().title).toBe('de:Find');
    expect(findInput().placeholder).toBe('de:Find');
    expect(replaceInput()!.title).toBe('de:Replace');
    expect(tool('explorer-replace-toggle')!.title).toBe('de:Toggle Replace');
    expect(tool('find-match-case')!.title).toBe('de:Match Case');
    expect(tool('find-whole-word')!.title).toBe('de:Match Whole Word');
    expect(tool('find-regex')!.title).toBe('de:Use Regular Expression');
    expect(tool('find-preserve-case')!.title).toBe('de:Preserve Case');
    expect(tool('find-replace-one')!.title).toBe('de:Replace (Enter)');
    expect(tool('find-replace-all')!.title).toBe('de:Replace All');
    expect(tool('find-previous')!.title).toBe(
      'de:Previous Match (Shift+Enter)'
    );
    expect(tool('find-next')!.title).toBe('de:Next Match (Enter)');
    expect(tool('find-scopes-toggle')!.title).toBe('de:Search In');
  });

  it('isolates the numbers it counts in a right-to-left language', async () => {
    await setup({ i18n: createTestI18n('ar-SA', pseudoMessages('ar')) });
    await open('user');

    expect(countText()).toBe('ar:⁨5⁩ matches');
  });
});
