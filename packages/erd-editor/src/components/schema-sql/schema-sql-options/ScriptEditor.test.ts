import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ScriptEditor from '@/components/schema-sql/schema-sql-options/ScriptEditor';
import type { ShikiService } from '@/services/shiki';
import { hasAppleDevice } from '@/utils/device-detect';

const mocks = vi.hoisted(() => ({
  getShikiService: vi.fn<() => ShikiService | null>(() => null),
}));

vi.mock('@/services/shiki', () => ({
  getShikiService: mocks.getShikiService,
}));

const highlightOf = (text: string) =>
  `<pre class="shiki" style="background-color:#24292e" tabindex="0"><code><span class="line">${text}</span></code></pre>`;

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  mocks.getShikiService.mockImplementation(() => null);
});

/** An editor whose value, theme and presence a case changes from outside, as the panel does. */
async function setup(value = '') {
  const state = observable({
    value,
    theme: 'dark' as 'dark' | 'light',
    readonly: false,
    shown: true,
  });
  const onCommit = vi.fn((next: string) => {
    state.value = next;
  });
  const Host: FC = () => () =>
    state.shown
      ? html`<${ScriptEditor}
          id=${'script'}
          value=${state.value}
          placeholder=${'-- hint'}
          theme=${state.theme}
          readonly=${state.readonly}
          .onCommit=${onCommit}
        />`
      : null;

  mounted = await mountAndFlush(html`<${Host} />`);
  const textarea = () =>
    (mounted as Mounted).container.querySelector(
      'textarea'
    ) as HTMLTextAreaElement;
  const preview = () =>
    (mounted as Mounted).container.querySelector(
      '[aria-hidden="true"]'
    ) as HTMLElement;

  return { state, onCommit, textarea, preview };
}

const type = (textarea: HTMLTextAreaElement, text: string) => {
  textarea.value = text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('ScriptEditor', () => {
  it("lays the text over a preview of it, left to right, with the field's own attributes", async () => {
    const { textarea, preview } = await setup('SELECT 1;');

    expect(textarea().value).toBe('SELECT 1;');
    expect(textarea().id).toBe('script');
    expect(textarea().placeholder).toBe('-- hint');
    expect(textarea().getAttribute('spellcheck')).toBe('false');
    expect(textarea().getAttribute('autocomplete')).toBe('off');
    expect(textarea().getAttribute('aria-readonly')).toBe('false');
    expect(preview().textContent).toBe('SELECT 1;');
    expect((textarea().parentElement as HTMLElement).dir).toBe('ltr');
  });

  it('commits once as it loses the focus, and not at all for no change', async () => {
    const { textarea, onCommit } = await setup('a');

    textarea().focus();
    textarea().blur();
    expect(onCommit).not.toHaveBeenCalled();

    textarea().focus();
    type(textarea(), 'ab');
    type(textarea(), 'abc');
    expect(onCommit).not.toHaveBeenCalled();
    textarea().blur();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('abc');
  });

  it("keeps the draft through a change of the document's script while focused, and follows one after", async () => {
    const { state, textarea } = await setup('a');

    textarea().focus();
    type(textarea(), 'mine');
    state.value = 'theirs';
    await flush();
    expect(textarea().value).toBe('mine');

    textarea().blur();
    state.value = 'later';
    await flush();
    expect(textarea().value).toBe('later');
  });

  it('commits what was typed when it goes while focused, and once', async () => {
    const { state, textarea, onCommit } = await setup('a');

    textarea().focus();
    type(textarea(), 'typed');
    state.shown = false;
    await flush();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('typed');
  });

  it('commits nothing when it goes unfocused', async () => {
    const { state, textarea, onCommit } = await setup('a');

    type(textarea(), 'typed');
    state.shown = false;
    await flush();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('highlights the draft, shows plain text until the new highlight lands and takes its background', async () => {
    const resolvers: Array<(highlight: string) => void> = [];
    const codeToHtml = vi.fn(
      (_text: string, _options: { lang: string; theme?: string }) =>
        new Promise<string>(resolve => resolvers.push(resolve))
    );
    mocks.getShikiService.mockImplementation(
      () => ({ codeToHtml }) as unknown as ShikiService
    );
    const { state, textarea, preview } = await setup('');

    expect(codeToHtml).toHaveBeenCalledWith('', { lang: 'sql', theme: 'dark' });
    resolvers[0](highlightOf(''));
    await flush();
    expect(preview().querySelector('pre.shiki')).not.toBeNull();
    expect(preview().querySelector('pre')?.hasAttribute('tabindex')).toBe(
      false
    );
    expect(
      (textarea().parentElement as HTMLElement).style.backgroundColor
    ).not.toBe('');

    type(textarea(), 'SELECT 1;');
    await flush();
    expect(preview().querySelector('pre.shiki')).toBeNull();
    expect(preview().textContent).toBe('SELECT 1;');

    type(textarea(), 'SELECT 2;');
    resolvers[1](highlightOf('SELECT 1;'));
    await flush();
    expect(preview().textContent).toBe('SELECT 2;');

    resolvers[2](highlightOf('SELECT 2;'));
    await flush();
    expect(preview().querySelector('pre.shiki')?.textContent).toBe('SELECT 2;');

    state.theme = 'light';
    await flush();
    expect(codeToHtml.mock.calls.at(-1)?.[1]).toEqual({
      lang: 'sql',
      theme: 'light',
    });
  });

  it("turns readonly into the field's own", async () => {
    const { state, textarea } = await setup('a');

    state.readonly = true;
    await flush();

    expect(textarea().readOnly).toBe(true);
    expect(textarea().getAttribute('aria-readonly')).toBe('true');
  });

  it('keeps a copy, a cut and a paste from the editor root, unprevented', async () => {
    const { textarea } = await setup('a');
    const behind = vi.fn();
    (mounted as Mounted).container.addEventListener('paste', behind);
    (mounted as Mounted).container.addEventListener('copy', behind);
    (mounted as Mounted).container.addEventListener('cut', behind);

    for (const type of ['copy', 'cut', 'paste']) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      textarea().dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(behind).not.toHaveBeenCalled();
  });

  it("keeps the editor's chords and a composition in the field, handing on find, the palette, Escape and the zoom", async () => {
    const { textarea } = await setup('a');
    const behind = vi.fn();
    (mounted as Mounted).container.addEventListener('keydown', behind);
    const press = (init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ...init,
      });
      textarea().dispatchEvent(event);
      return event;
    };

    const mod = hasAppleDevice() ? { metaKey: true } : { ctrlKey: true };
    const undo = press({ key: 'z', code: 'KeyZ', ...mod });
    const option = press({ key: 'n', code: 'KeyN', altKey: true });
    const composing = press({ key: 'a', code: 'KeyA', isComposing: true });
    const letter = press({ key: 'a', code: 'KeyA' });
    const escape = press({ key: 'Escape', code: 'Escape' });

    expect(
      [undo, option, composing].map(event => event.defaultPrevented)
    ).toEqual([false, false, false]);
    expect(behind.mock.calls.map(([event]) => event)).toEqual([letter, escape]);
  });
});
