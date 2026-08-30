import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import CodeBlock from '@/components/primitives/code-block/CodeBlock';
import * as styles from '@/components/primitives/code-block/CodeBlock.styles';
import {
  setGetShikiServiceCallback,
  ShikiService,
} from '@/services/shikiService';

const HIGHLIGHT = `<pre class="shiki" style="background-color:#123456" tabindex="0"><code><span class="line">SELECT 1;</span></code></pre>`;

const createShikiService = (highlight = HIGHLIGHT) => {
  const codeToHtml = vi.fn<ShikiService['codeToHtml']>(async () => highlight);
  const service: ShikiService = { codeToHtml } as unknown as ShikiService;
  return { service, codeToHtml };
};

/** A CodeBlock whose highlights stay in flight until the test resolves them by hand. */
const pendingHighlight = () => {
  const deferred: Array<(highlight: string) => void> = [];
  const codeToHtml = vi.fn(
    () => new Promise<string>(resolve => deferred.push(resolve))
  );
  setGetShikiServiceCallback(() => ({ codeToHtml }) as unknown as ShikiService);

  const state = observable({
    value: 'SELECT 1;',
    theme: 'dark' as 'dark' | 'light',
  });
  const Pending: FC<any> = () => () =>
    html`<${CodeBlock}
      value=${state.value}
      lang=${'sql'}
      theme=${state.theme}
    />`;

  return { state, deferred, Pending };
};

const getRoot = (mounted: Mounted) =>
  mounted.container.firstElementChild as HTMLDivElement;

const getScroller = (mounted: Mounted) =>
  mounted.container.querySelector(
    `.${String(styles.scroller)}`
  ) as HTMLDivElement;

const getLayers = (mounted: Mounted) =>
  mounted.container.querySelector(
    `.${String(styles.layers)}`
  ) as HTMLDivElement;

const getPreview = (mounted: Mounted) =>
  mounted.container.querySelector(
    `.${String(styles.preview)}`
  ) as HTMLDivElement;

const getTextarea = (mounted: Mounted) =>
  mounted.container.querySelector('textarea') as HTMLTextAreaElement;

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

    const preview = getPreview(mounted);
    expect(preview).toBeTruthy();
    expect(preview.textContent).toBe('SELECT 1;');
    expect(preview.querySelector('pre.shiki')).toBeNull();
    expect(getScroller(mounted).style.backgroundColor).toBe('');
  });

  it('commits the unhighlighted value as text, so both layers hold the same characters', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'List<String> ids;'} lang=${'java'} />`
    );

    const preview = getPreview(mounted);
    expect(preview.textContent).toBe('List<String> ids;');
    expect(preview.children).toHaveLength(0);
    expect(getTextarea(mounted).value).toBe('List<String> ids;');
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

  it('overlays the preview with a textarea carrying the raw value', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    const textarea = getTextarea(mounted);
    expect(textarea).toBeTruthy();
    expect(textarea.disabled).toBe(false);
    expect(textarea.value).toBe('SELECT 1;');
    expect(textarea.previousElementSibling).toBe(getPreview(mounted));
  });

  it('stays focusable and caret-bearing rather than readonly, which Chrome paints no caret in', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    const textarea = getTextarea(mounted);
    expect(textarea.readOnly).toBe(false);
    expect(textarea.hasAttribute('readonly')).toBe(false);
    expect(textarea.getAttribute('aria-readonly')).toBe('true');
    expect(textarea.getAttribute('tabindex')).toBe('0');
    expect(textarea.getAttribute('inputmode')).toBe('none');
    expect(textarea.getAttribute('spellcheck')).toBe('false');
    expect(textarea.getAttribute('autocorrect')).toBe('off');
    expect(textarea.getAttribute('autocapitalize')).toBe('off');
    expect(textarea.getAttribute('autocomplete')).toBe('off');
  });

  it('refuses every edit the now-editable overlay could otherwise take', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    const textarea = getTextarea(mounted);
    const beforeinput = new Event('beforeinput', {
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(beforeinput);
    expect(beforeinput.defaultPrevented).toBe(true);

    // the composition paths that are not cancelable land here instead
    textarea.value = 'DROP TABLE users;';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(textarea.value).toBe('SELECT 1;');
  });

  it('keeps a paste inside the overlay, away from the editor root that would act on it', async () => {
    const onRootPaste = vi.fn();
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );
    mounted.container.addEventListener('paste', onRootPaste);

    const paste = new Event('paste', { bubbles: true, cancelable: true });
    getTextarea(mounted).dispatchEvent(paste);

    expect(paste.defaultPrevented).toBe(true);
    expect(onRootPaste).not.toHaveBeenCalled();
  });

  it('names the overlay, which is the only thing left in the accessibility tree', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    expect(getTextarea(mounted).getAttribute('aria-label')).toBe('Code');
    expect(getPreview(mounted).getAttribute('aria-hidden')).toBe('true');
  });

  it('strips the trailing newline, which a textarea turns into a line the preview has not got', async () => {
    const { service, codeToHtml } = createShikiService();
    setGetShikiServiceCallback(() => service);
    const onCopy = vi.fn();

    mounted = await mountAndFlush(
      html`<${CodeBlock}
        value=${'SELECT 1;\nSELECT 2;\n'}
        lang=${'sql'}
        .onCopy=${onCopy}
      />`
    );

    expect(getTextarea(mounted).value).toBe('SELECT 1;\nSELECT 2;');
    expect(codeToHtml).toHaveBeenCalledWith('SELECT 1;\nSELECT 2;', {
      lang: 'sql',
      theme: undefined,
    });

    getClipboard(mounted).dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await flush();

    expect(onCopy).toHaveBeenCalledWith('SELECT 1;\nSELECT 2;');
  });

  it('keeps the unhighlighted preview on the same characters as the overlay', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;\n\n'} lang=${'sql'} />`
    );

    expect(getPreview(mounted).textContent).toBe('SELECT 1;');
    expect(getTextarea(mounted).value).toBe('SELECT 1;');
  });

  it('nests the two layers inside the one scroll container', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    const root = getRoot(mounted);
    const scroller = getScroller(mounted);
    const layers = getLayers(mounted);

    expect(scroller.parentElement).toBe(root);
    expect(layers.parentElement).toBe(scroller);
    expect(getPreview(mounted).parentElement).toBe(layers);
    expect(getTextarea(mounted).parentElement).toBe(layers);
    // the clipboard button sits outside the scroller, last, so it stays pinned and on top
    expect(root.lastElementChild).toBe(getClipboard(mounted));
    expect(scroller.contains(getClipboard(mounted))).toBe(false);
  });

  it('opts only the scroller into the scrollbar hook, never the overlay', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    expect(getScroller(mounted).classList.contains('scrollbar')).toBe(true);
    expect(getTextarea(mounted).classList.contains('scrollbar')).toBe(false);
    expect(getPreview(mounted).classList.contains('scrollbar')).toBe(false);
    expect(mounted.container.querySelectorAll('.scrollbar')).toHaveLength(1);
  });

  it('keeps the textarea on the raw value once the highlight lands', async () => {
    const { service } = createShikiService();
    setGetShikiServiceCallback(() => service);

    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    expect(getPreview(mounted).querySelector('pre.shiki')).toBeTruthy();
    expect(getTextarea(mounted).value).toBe('SELECT 1;');
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

    const pre = getPreview(mounted).querySelector(
      'pre.shiki'
    ) as HTMLPreElement;
    expect(pre).toBeTruthy();
    expect(pre.style.backgroundColor).not.toBe('');
    expect(getScroller(mounted).style.backgroundColor).toBe(
      pre.style.backgroundColor
    );
  });

  it('drops the tab stop shiki puts on its pre', async () => {
    const { service } = createShikiService();
    setGetShikiServiceCallback(() => service);

    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    const pre = getPreview(mounted).querySelector(
      'pre.shiki'
    ) as HTMLPreElement;
    expect(pre).toBeTruthy();
    expect(pre.hasAttribute('tabindex')).toBe(false);
  });

  it('leaves the background color empty when the highlight has no pre.shiki', async () => {
    const { service } = createShikiService(
      '<div class="plain">SELECT 1;</div>'
    );
    setGetShikiServiceCallback(() => service);

    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    expect(getPreview(mounted).querySelector('.plain')).toBeTruthy();
    expect(getScroller(mounted).style.backgroundColor).toBe('');
  });

  it('leaves the background color empty when pre.shiki carries no background', async () => {
    const { service } = createShikiService(
      '<pre class="shiki"><code>SELECT 1;</code></pre>'
    );
    setGetShikiServiceCallback(() => service);

    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    expect(getPreview(mounted).querySelector('pre.shiki')).toBeTruthy();
    expect(getScroller(mounted).style.backgroundColor).toBe('');
  });

  it('registers no scroll listener, because the scroller carries both layers', async () => {
    const { service } = createShikiService();
    setGetShikiServiceCallback(() => service);

    const addEventListener = vi.spyOn(
      HTMLTextAreaElement.prototype,
      'addEventListener'
    );

    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );

    const textarea = getTextarea(mounted);
    const scrollRegistrations = addEventListener.mock.calls.filter(
      ([type]) => type === 'scroll'
    );
    addEventListener.mockRestore();
    expect(scrollRegistrations).toEqual([]);

    // a sync listener would only be observable from a non-zero offset, so give it one
    textarea.scrollTop = 42;
    textarea.scrollLeft = 42;
    textarea.dispatchEvent(new Event('scroll'));
    await flush();

    const preview = getPreview(mounted);
    expect(preview.scrollTop).toBe(0);
    expect(preview.scrollLeft).toBe(0);
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
    expect(getTextarea(mounted).value).toBe('SELECT 2;');

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

  it('drops the stale highlight the moment the value changes, so both layers hold one text', async () => {
    const { state, deferred, Pending } = pendingHighlight();

    mounted = await mountAndFlush(html`<${Pending} />`);
    deferred[0](HIGHLIGHT);
    await flush();
    expect(getPreview(mounted).querySelector('pre.shiki')).toBeTruthy();

    state.value = 'SELECT 2;\nSELECT 3;';
    await flush();

    const preview = getPreview(mounted);
    expect(preview.querySelector('pre.shiki')).toBeNull();
    expect(preview.textContent).toBe('SELECT 2;\nSELECT 3;');
    expect(getTextarea(mounted).value).toBe('SELECT 2;\nSELECT 3;');

    deferred[1](HIGHLIGHT);
    await flush();
    expect(getPreview(mounted).querySelector('pre.shiki')).toBeTruthy();
  });

  it('keeps the highlight through a theme change, which moves no glyph', async () => {
    const { state, deferred, Pending } = pendingHighlight();

    mounted = await mountAndFlush(html`<${Pending} />`);
    deferred[0](HIGHLIGHT);
    await flush();

    state.theme = 'light';
    await flush();

    expect(deferred).toHaveLength(2);
    expect(getPreview(mounted).querySelector('pre.shiki')).toBeTruthy();
  });

  it('ignores a highlight a newer request has already superseded', async () => {
    const { state, deferred, Pending } = pendingHighlight();

    mounted = await mountAndFlush(html`<${Pending} />`);
    state.value = 'SELECT 2;';
    await flush();
    expect(deferred).toHaveLength(2);

    deferred[1](
      '<pre class="shiki"><code class="fresh">SELECT 2;</code></pre>'
    );
    await flush();
    deferred[0](
      '<pre class="shiki"><code class="stale">SELECT 1;</code></pre>'
    );
    await flush();

    const preview = getPreview(mounted);
    expect(preview.querySelector('.fresh')).toBeTruthy();
    expect(preview.querySelector('.stale')).toBeNull();
  });

  it('re-highlights when the shiki service loads after mount', async () => {
    mounted = await mountAndFlush(
      html`<${CodeBlock} value=${'SELECT 1;'} lang=${'sql'} />`
    );
    expect(getPreview(mounted).querySelector('pre.shiki')).toBeNull();

    const { service, codeToHtml } = createShikiService();
    setGetShikiServiceCallback(() => service);
    await flush();

    expect(codeToHtml).toHaveBeenCalledTimes(1);
    expect(getPreview(mounted).querySelector('pre.shiki')).toBeTruthy();
  });

  it('tolerates a highlight resolving after unmount, once the preview ref is released', async () => {
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
    const scroller = getScroller(mounted);
    const root = getRoot(mounted);
    expect(codeToHtml).toHaveBeenCalledTimes(1);

    mounted.unmount();
    mounted = null;

    resolveHighlight(HIGHLIGHT);
    await flush();

    // the ref directive nulls preview.value on destroy, so getPre bails out and the background
    // color is never committed to the detached node
    expect(scroller.style.backgroundColor).toBe('');
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
