import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Toast from '@/components/primitives/toast/Toast';
import * as styles from '@/components/primitives/toast/Toast.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const query = (token: unknown) =>
  mounted!.container.querySelector(
    `.${CSS.escape(String(token))}`
  ) as HTMLElement | null;

describe('Toast', () => {
  it('renders the root even when every prop is omitted', async () => {
    mounted = await mountAndFlush(html`<${Toast} />`);

    expect(query(styles.root)).toBeTruthy();
    expect(query(styles.textWrap)).toBeNull();
    expect(query(styles.action)).toBeNull();
  });

  it('renders the title inside the text wrapper', async () => {
    mounted = await mountAndFlush(html`<${Toast} title=${'Scheduled'} />`);

    const textWrap = query(styles.textWrap);
    const title = query(styles.title);
    expect(textWrap).toBeTruthy();
    expect(title).toBeTruthy();
    expect(title?.parentElement).toBe(textWrap);
    expect(title?.textContent?.trim()).toBe('Scheduled');
    expect(query(styles.description)).toBeNull();
  });

  it('renders the description without a title', async () => {
    mounted = await mountAndFlush(html`<${Toast} description=${'Tuesday'} />`);

    expect(query(styles.textWrap)).toBeTruthy();
    expect(query(styles.title)).toBeNull();
    expect(query(styles.description)?.textContent?.trim()).toBe('Tuesday');
  });

  it('renders title and description together', async () => {
    mounted = await mountAndFlush(
      html`<${Toast} title=${'Scheduled'} description=${'Tuesday'} />`
    );

    expect(query(styles.title)?.textContent?.trim()).toBe('Scheduled');
    expect(query(styles.description)?.textContent?.trim()).toBe('Tuesday');
  });

  it('renders the action slot only when an action is given', async () => {
    mounted = await mountAndFlush(
      html`<${Toast} action=${html`<button class="undo">Undo</button>`} />`
    );

    const action = query(styles.action);
    expect(action).toBeTruthy();
    expect(action?.querySelector('.undo')?.textContent).toBe('Undo');
    expect(query(styles.textWrap)).toBeNull();
  });

  it('renders template literals for the title', async () => {
    mounted = await mountAndFlush(
      html`<${Toast} title=${html`<em class="em">Hi</em>`} />`
    );

    expect(query(styles.title)?.querySelector('.em')?.textContent).toBe('Hi');
  });

  it('treats an empty string title and description as absent', async () => {
    mounted = await mountAndFlush(
      html`<${Toast} title=${''} description=${''} />`
    );

    expect(query(styles.textWrap)).toBeNull();
  });

  it('renders text and action side by side under the root', async () => {
    mounted = await mountAndFlush(
      html`<${Toast}
        title=${'Scheduled'}
        description=${'Tuesday'}
        action=${html`<button class="undo">Undo</button>`}
      />`
    );

    const root = query(styles.root) as HTMLElement;
    const children = [...root.children];
    expect(children.length).toBe(2);
    expect([...children[0].classList]).toContain(String(styles.textWrap));
    expect([...children[1].classList]).toContain(String(styles.action));
  });

  it('adds and removes the sections reactively', async () => {
    const state = observable<{ title: string; action: string }>({
      title: 'Scheduled',
      action: '',
    });
    const Wrapper: FC = () => () =>
      html`<${Toast} title=${state.title} action=${state.action} />`;

    mounted = await mountAndFlush(html`<${Wrapper} />`);
    expect(query(styles.title)?.textContent?.trim()).toBe('Scheduled');
    expect(query(styles.action)).toBeNull();

    state.title = '';
    state.action = 'Undo';
    await flush();

    expect(query(styles.textWrap)).toBeNull();
    expect(query(styles.action)?.textContent?.trim()).toBe('Undo');
  });
});
