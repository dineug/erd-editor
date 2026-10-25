// The palette under a Korean IME in a real Chromium: Chrome's own composition
// hands the input each step of a syllable, which only the browser shows.

import { addCSSHost, html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { cdp, userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import {
  seedClusterTables,
  seedHangulDocument,
} from '@/__test-utils__/hangulSeed';
import type { AppContext } from '@/components/appContext';
import * as highlightStyles from '@/components/primitives/highlighted-text/HighlightedText.styles';
import { createScopeActions } from '@/components/quick-search/actions';
import {
  PALETTE_LIST_MAX_HEIGHT,
  PALETTE_ROW_HEIGHT,
} from '@/components/quick-search/paletteList';
import QuickSearch from '@/components/quick-search/QuickSearch';
import * as styles from '@/components/quick-search/QuickSearch.styles';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { hasAppleDevice } from '@/utils/device-detect';
import { toggleSearchAction } from '@/utils/emitter';
import { VIRTUAL_OVERSCAN } from '@/utils/virtualRange';

/** The key $mod names in the browser the spec runs in. */
const MOD = hasAppleDevice() ? 'Meta' : 'Control';

/** The two Input commands the spec sends, which the provider's session types only under its own config. */
type ImeSession = {
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
};

const session = () => cdp() as unknown as ImeSession;

let mounted: Mounted | null = null;
let shadowHost: HTMLElement | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  shadowHost?.remove();
  shadowHost = null;
});

async function setup(seed?: (app: AppContext) => void) {
  const app = createTestAppContext();
  seedHangulDocument(app);
  seed?.(app);
  mounted = mount(
    html`<${QuickSearch} .topLevel=${createScopeActions} />`,
    app
  );
  await flush();
  app.emitter.emit(toggleSearchAction());
  await flush();

  const input = mounted.container.querySelector('input') as HTMLInputElement;
  input.focus();
  const events: string[] = [];
  for (const type of ['compositionstart', 'compositionend']) {
    input.addEventListener(type, () => events.push(type));
  }
  return { app, input, events };
}

/** The syllable an IME is building, shown in the input and not yet committed. */
const compose = async (text: string) => {
  await session().send('Input.imeSetComposition', {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
  await flush();
};

/** The IME finishing the syllable it was building, as the next key does. */
const commit = async (text: string) => {
  await session().send('Input.insertText', { text });
  await flush();
};

const rowNames = () =>
  Array.from(
    mounted?.container.querySelectorAll(`.${styles.action} .${styles.name}`) ??
      []
  ).map(name => (name.textContent ?? '').trim());

/** The names of the table rows, which only the # prefix lists. */
const tableNames = () =>
  Array.from(
    mounted?.container.querySelectorAll(`.${styles.action}`) ?? []
  ).flatMap(row =>
    row.querySelector(`.${styles.keyword}`)?.textContent?.trim() === 'Table'
      ? [(row.querySelector(`.${styles.name}`)?.textContent ?? '').trim()]
      : []
  );

/** The index of the row the arrows stand on, or -1. */
const selected = () =>
  Array.from(
    mounted?.container.querySelectorAll(`.${styles.action}`) ?? []
  ).findIndex(row => row.classList.contains('selected'));

/** The marks lit in the name of the row at the index given. */
const lit = (index = 0) => {
  const row = mounted?.container
    .querySelectorAll(`.${styles.action}`)
    .item(index);
  return Array.from(
    row?.querySelectorAll(`.${styles.name} .${highlightStyles.highlighted}`) ??
      []
  ).map(mark => mark.textContent);
};

/**
 * Types 사용자 the way a two-set Korean keyboard does, one jamo a key, and
 * reads the input, the list and its tables after each: ㅅ, 사, 상, 사요, 사용,
 * 사용ㅈ, 사용자.
 */
async function typeSayongja(): Promise<
  Array<[value: string, names: string[], tables: string[]]>
> {
  const input = mounted?.container.querySelector('input') as HTMLInputElement;
  const seen: Array<[string, string[], string[]]> = [];
  const read = () => seen.push([input.value, rowNames(), tableNames()]);

  for (const step of ['ㅅ', '사', '상']) {
    await compose(step);
    read();
  }
  await commit('사');
  for (const step of ['요', '용']) {
    await compose(step);
    read();
  }
  await commit('용');
  for (const step of ['ㅈ', '자']) {
    await compose(step);
    read();
  }
  await commit('자');
  read();

  return seen;
}

describe('quick search under a Korean IME', () => {
  it('lists no table at any step the IME composes with no prefix, and hands the word to # by the keys', async () => {
    const { input, events } = await setup();

    const seen = await typeSayongja();

    expect(seen.map(([value]) => value)).toEqual([
      'ㅅ',
      '사',
      '상',
      '사요',
      '사용',
      '사용ㅈ',
      '사용자',
      '사용자',
    ]);
    for (const [value, names, tables] of seen) {
      expect(tables).toEqual([]);
      expect(names[0]).toBe(`Search tables for "${value}"`);
    }
    expect(events).toContain('compositionstart');
    expect(events).toContain('compositionend');

    await userEvent.keyboard('{ArrowDown}{Enter}');
    await flush();

    expect(input.value).toBe('#사용자');
    expect(tableNames()).toEqual(['사용자']);
  });

  it('leaves an arrow or Enter pressed mid-syllable to the IME, and acts on the next', async () => {
    const { app, input } = await setup();
    await userEvent.keyboard('#');
    const composing: boolean[] = [];
    input.addEventListener('keydown', event =>
      composing.push(event.isComposing)
    );

    await commit('사용');
    await compose('ㅈ');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    await flush();

    expect(composing).toEqual([true, true]);
    expect(selected()).toBe(-1);
    expect(app.store.state.editor.openMap.search).toBe(true);

    await commit('자');
    await userEvent.keyboard('{ArrowDown}');
    expect(selected()).toBe(0);
    await userEvent.keyboard('{Enter}');
    await flush();

    expect(app.store.state.editor.openMap.search).toBe(false);
    expect(app.store.state.editor.selectedMap).toEqual({ users: 'table' });
  });

  it('keeps it in a scope a real key typed, and finds a table by its initials', async () => {
    await setup();

    await userEvent.keyboard('#');
    const seen = await typeSayongja();

    for (const [value, names] of seen) {
      expect(value.startsWith('#')).toBe(true);
      expect(names).toContain('사용자');
    }
    // 상품 goes once the IME has spelled past 상.
    expect(seen.at(-1)?.[1]).toEqual(['사용자']);

    await userEvent.keyboard(`{${MOD}>}a{/${MOD}}#`);
    for (const step of ['ㅈ', 'ㅈㅁ']) {
      await compose(step);
    }

    expect(rowNames()).toEqual(['주문 내역']);
    expect(lit()).toEqual(['주문']);
  });

  it('lights the syllables an unfinished one spells, below a name holding it as typed', async () => {
    await setup();

    await userEvent.keyboard('@');
    for (const step of ['ㅅ', '사', '상']) {
      await compose(step);
    }

    expect(rowNames()).toEqual(['상품명', '사용자']);
    expect(lit(0)).toEqual(['상']);
    expect(lit(1)).toEqual(['사용']);
  });

  it('keeps a table under # through the cluster a Windows IME composes of two initials', async () => {
    const { input } = await setup(seedClusterTables);

    await userEvent.keyboard('#');
    for (const step of ['ㅂ', 'ㅄ']) {
      await compose(step);
      expect(tableNames().sort()).toEqual(['배송지', '부서']);
    }
    await commit('ㅄ');
    await compose('ㅈ');

    expect(input.value).toBe('#ㅄㅈ');
    expect(tableNames()).toEqual(['배송지']);
  });
});

describe('quick search over a long list', () => {
  const TABLES = 300;

  it('draws only the rows in view, and brings the keyboard row into view at either end', async () => {
    shadowHost = document.createElement('div');
    shadowHost.setAttribute(
      'style',
      'position: relative; width: 800px; height: 700px;'
    );
    document.body.append(shadowHost);
    const shadow = shadowHost.attachShadow({ mode: 'open' });
    addCSSHost(shadow);
    const app = createTestAppContext();
    for (let index = 0; index < TABLES; index++) {
      const id = `t${index}`;
      app.store.dispatchSync(
        addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeTableNameAction({
          id,
          value: `t${String(index).padStart(3, '0')}`,
        })
      );
    }
    mounted = mount(
      html`<${QuickSearch} .topLevel=${createScopeActions} />`,
      app,
      shadow
    );
    await flush();
    app.emitter.emit(toggleSearchAction());
    await flush();

    const input = shadow.querySelector('input') as HTMLInputElement;
    input.value = '#';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flush();
    const list = shadow.querySelector(`.${styles.list}`) as HTMLElement;
    const rows = () => shadow.querySelectorAll(`.${styles.action}`);
    const inView = (row: Element) => {
      const box = list.getBoundingClientRect();
      const { top, bottom } = row.getBoundingClientRect();
      return top >= box.top - 0.5 && bottom <= box.bottom + 0.5;
    };
    const shown = Math.ceil(PALETTE_LIST_MAX_HEIGHT / PALETTE_ROW_HEIGHT);

    expect(list.clientHeight).toBe(PALETTE_LIST_MAX_HEIGHT);
    expect(list.scrollHeight).toBe(TABLES * PALETTE_ROW_HEIGHT);
    expect(rows()).toHaveLength(shown + VIRTUAL_OVERSCAN);

    await userEvent.keyboard('{ArrowUp}');
    await flush();
    const last = shadow.querySelector(`.${styles.action}.selected`)!;
    expect(last.textContent).toContain(`t${TABLES - 1}`);
    expect(inView(last)).toBe(true);
    expect(rows().length).toBeLessThanOrEqual(shown + VIRTUAL_OVERSCAN);

    await userEvent.keyboard('{ArrowDown}');
    await flush();
    const first = shadow.querySelector(`.${styles.action}.selected`)!;
    expect(first.textContent).toContain('t000');
    expect(inView(first)).toBe(true);
    expect(list.scrollTop).toBe(0);
  });
});

describe('quick search in a short host', () => {
  it('keeps the list inside the host, and the keyboard row in view in it', async () => {
    shadowHost = document.createElement('div');
    shadowHost.setAttribute(
      'style',
      'position: relative; width: 600px; height: 300px; overflow: hidden;'
    );
    document.body.append(shadowHost);
    const shadow = shadowHost.attachShadow({ mode: 'open' });
    addCSSHost(shadow);
    const app = createTestAppContext();
    for (let index = 0; index < 30; index++) {
      const id = `t${index}`;
      app.store.dispatchSync(
        addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeTableNameAction({
          id,
          value: `t${String(index).padStart(2, '0')}`,
        })
      );
    }
    mounted = mount(
      html`<${QuickSearch} .topLevel=${createScopeActions} />`,
      app,
      shadow
    );
    await flush();
    app.emitter.emit(toggleSearchAction());
    await flush();

    const input = shadow.querySelector('input') as HTMLInputElement;
    input.value = '#';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flush();
    const host = shadowHost.getBoundingClientRect();
    const list = shadow.querySelector(`.${styles.list}`) as HTMLElement;

    expect(list.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      host.bottom
    );
    expect(list.clientHeight).toBeLessThan(PALETTE_LIST_MAX_HEIGHT);

    for (let step = 0; step < 8; step++) {
      await userEvent.keyboard('{ArrowDown}');
    }
    await flush();
    const row = shadow.querySelector(`.${styles.action}.selected`)!;
    const box = list.getBoundingClientRect();
    const { top, bottom } = row.getBoundingClientRect();

    expect(row.textContent).toContain('t07');
    expect(top).toBeGreaterThanOrEqual(box.top - 0.5);
    expect(bottom).toBeLessThanOrEqual(box.bottom + 0.5);
  });
});
