import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import CodeBlock from '@/components/primitives/code-block/CodeBlock';
import {
  setGetShikiServiceCallback,
  ShikiService,
} from '@/services/shikiService';

const HIGHLIGHT = `<pre class="shiki" style="background-color:#123456"><code><span class="line">SELECT 1;</span></code></pre>`;

const createShikiService = (highlight = HIGHLIGHT) => {
  const codeToHtml = vi.fn<ShikiService['codeToHtml']>(async () => highlight);
  const service: ShikiService = { codeToHtml } as unknown as ShikiService;
  return { service, codeToHtml };
};

const getRoot = (mounted: Mounted) =>
  mounted.container.firstElementChild as HTMLDivElement;

const getCode = (mounted: Mounted) =>
  mounted.container.querySelector('.scrollbar') as HTMLDivElement;

const getClipboard = (mounted: Mounted) =>
  mounted.container.querySelector('[title="Copy"]') as HTMLDivElement;

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  setGetShikiServiceCallback(() => null);
});

describe('CodeBlock', () => {
  it('renders the raw value when no shiki service is registered', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    const code = getCode(mounted);
    expect(code).toBeTruthy();
    expect(code.textContent).toBe('SELECT 1;');
    expect(code.querySelector('pre.shiki')).toBeNull();
    expect(code.style.backgroundColor).toBe('');
  });

  it('renders the copy affordance with the far/copy icon', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    const clipboard = getClipboard(mounted);
    expect(clipboard).toBeTruthy();
    expect(clipboard.querySelector('svg')).toBeTruthy();
    expect(getRoot(mounted).contains(clipboard)).toBe(true);
  });

  it('highlights through the shiki service and adopts its background color', async () => {
    const { service, codeToHtml } = createShikiService();
    setGetShikiServiceCallback(() => service);

    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} theme=${'dark'} />`
    );

    expect(codeToHtml).toHaveBeenCalledWith('SELECT 1;', {
      lang: 'sql',
      theme: 'dark',
    });

    const code = getCode(mounted);
    const pre = code.querySelector('pre.shiki') as HTMLPreElement;
    expect(pre).toBeTruthy();
    expect(pre.style.backgroundColor).not.toBe('');
    expect(code.style.backgroundColor).toBe(pre.style.backgroundColor);
  });

  it('leaves the background color empty when the highlight has no pre.shiki', async () => {
    const { service } = createShikiService(
      '<div class="plain">SELECT 1;</div>'
    );
    setGetShikiServiceCallback(() => service);

    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    const code = getCode(mounted);
    expect(code.querySelector('.plain')).toBeTruthy();
    expect(code.style.backgroundColor).toBe('');
  });

  it('leaves the background color empty when pre.shiki carries no background', async () => {
    const { service } = createShikiService(
      '<pre class="shiki"><code>SELECT 1;</code></pre>'
    );
    setGetShikiServiceCallback(() => service);

    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    const code = getCode(mounted);
    expect(code.querySelector('pre.shiki')).toBeTruthy();
    expect(code.style.backgroundColor).toBe('');
  });

  it('calls onCopy with the current value when the clipboard button is clicked', async () => {
    const onCopy = vi.fn();
    mounted = await mountAndFlush(
      html`<${CodeBlock}
        value=${'SELECT 1;'}
        lang=${'sql'}
        .onCopy=${onCopy}
      />`
    );

    getClipboard(mounted).dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await flush();

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith('SELECT 1;');
  });

  it('does not throw when clicked without an onCopy handler', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    expect(() => {
      getClipboard(mounted as Mounted).dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    }).not.toThrow();
  });

  it('re-highlights when a watched prop changes and ignores unwatched props', async () => {
    const { service, codeToHtml } = createShikiService();
    setGetShikiServiceCallback(() => service);

    const state = observable({
      value: 'SELECT 1;',
      theme: 'dark' as 'dark' | 'light',
      onCopy: () => {},
    });
    const Parent: FC<any> = () => () =>
      html`<${CodeBlock}
        value=${state.value}
        lang=${'sql'}
        theme=${state.theme}
        .onCopy=${state.onCopy}
      />`;

    mounted = await mountAndFlush(html`<${Parent} />`);
    const initialCalls = codeToHtml.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    state.value = 'SELECT 2;';
    await flush();
    expect(codeToHtml.mock.calls.length).toBe(initialCalls + 1);
    expect(codeToHtml.mock.calls.at(-1)?.[0]).toBe('SELECT 2;');

    state.theme = 'light';
    await flush();
    expect(codeToHtml.mock.calls.length).toBe(initialCalls + 2);
    expect(codeToHtml.mock.calls.at(-1)?.[1]).toEqual({
      lang: 'sql',
      theme: 'light',
    });

    const callsBeforeUnwatched = codeToHtml.mock.calls.length;
    state.onCopy = () => {};
    await flush();
    expect(codeToHtml.mock.calls.length).toBe(callsBeforeUnwatched);
  });

  it('re-highlights when the shiki service loads after mount', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );
    expect(getCode(mounted).querySelector('pre.shiki')).toBeNull();

    const { service, codeToHtml } = createShikiService();
    setGetShikiServiceCallback(() => service);
    await flush();

    expect(codeToHtml).toHaveBeenCalledTimes(1);
    expect(getCode(mounted).querySelector('pre.shiki')).toBeTruthy();
  });

  it('tolerates a highlight resolving after unmount, once the root ref is released', async () => {
    let resolveHighlight: (value: string) => void = () => {};
    const codeToHtml = vi.fn(
      () =>
        new Promise<string>(resolve => {
          resolveHighlight = resolve;
        })
    );
    setGetShikiServiceCallback(
      () => ({ codeToHtml }) as unknown as ShikiService
    );

    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );
    const code = getCode(mounted);
    const root = getRoot(mounted);
    expect(codeToHtml).toHaveBeenCalledTimes(1);

    mounted.unmount();
    mounted = null;

    resolveHighlight(HIGHLIGHT);
    await flush();

    // the ref directive nulls `root.value` on destroy, so `getBackgroundColor`
    // bails out and no background color is ever committed to the detached node
    expect(code.style.backgroundColor).toBe('');
    expect(root.isConnected).toBe(false);
  });

  it('tears down its subscriptions on unmount', async () => {
    const { service, codeToHtml } = createShikiService();
    setGetShikiServiceCallback(() => service);

    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );
    const callsWhileMounted = codeToHtml.mock.calls.length;

    mounted.unmount();
    const container = mounted.container;
    mounted = null;

    setGetShikiServiceCallback(() => service);
    await flush();

    expect(codeToHtml.mock.calls.length).toBe(callsWhileMounted);
    expect(container.querySelector('.scrollbar')).toBeNull();
  });
});
