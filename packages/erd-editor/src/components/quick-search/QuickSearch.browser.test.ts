// The palette under a Korean IME in a real Chromium: Chrome's own composition
// hands the input each step of a syllable, which only the browser shows.

import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { cdp, userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import { seedHangulDocument } from '@/__test-utils__/hangulSeed';
import * as highlightStyles from '@/components/primitives/highlighted-text/HighlightedText.styles';
import QuickSearch from '@/components/quick-search/QuickSearch';
import * as styles from '@/components/quick-search/QuickSearch.styles';
import { hasAppleDevice } from '@/utils/device-detect';
import { toggleSearchAction } from '@/utils/emitter';

/** The key $mod names in the browser the spec runs in. */
const MOD = hasAppleDevice() ? 'Meta' : 'Control';

/** The two Input commands the spec sends, which the provider's session types only under its own config. */
type ImeSession = {
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
};

const session = () => cdp() as unknown as ImeSession;

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function setup() {
  const app = createTestAppContext();
  seedHangulDocument(app);
  mounted = mount(html`<${QuickSearch} />`, app);
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

const lit = () =>
  Array.from(
    mounted?.container.querySelectorAll(
      `.${styles.action}:first-child .${styles.name} .${highlightStyles.highlighted}`
    ) ?? []
  ).map(mark => mark.textContent);

/**
 * Types 사용자 the way a two-set Korean keyboard does, one jamo a key, and
 * reads the input and the list after each: ㅅ, 사, 상, 사요, 사용, 사용ㅈ, 사용자.
 */
async function typeSayongja(): Promise<Array<[string, string[]]>> {
  const input = mounted?.container.querySelector('input') as HTMLInputElement;
  const seen: Array<[string, string[]]> = [];
  const read = () => seen.push([input.value, rowNames()]);

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
  it('keeps 사용자 in the narrowed list at every step the IME composes', async () => {
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
    for (const [, names] of seen) {
      expect(names).toContain('사용자');
    }
    expect(events).toContain('compositionstart');
    expect(events).toContain('compositionend');
    expect(input.value).toBe('사용자');
    expect(rowNames()[0]).toBe('사용자');
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

  it('lights the syllables an unfinished one spells', async () => {
    await setup();

    await userEvent.keyboard('@');
    for (const step of ['ㅅ', '사', '상']) {
      await compose(step);
    }

    expect(rowNames()).toEqual(['사용자', '상품명']);
    expect(lit()).toEqual(['사용']);
  });
});
