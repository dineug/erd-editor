import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Separator from '@/components/primitives/separator/Separator';
import * as styles from '@/components/primitives/separator/Separator.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const wrapper = () => mounted!.container.querySelector('div') as HTMLDivElement;
const line = () =>
  mounted!.container.querySelector(
    `.${CSS.escape(String(styles.separator))}`
  ) as HTMLDivElement;

describe('Separator', () => {
  it('renders a line wrapped in a padding box', async () => {
    mounted = await mountAndFlush(html`<${Separator} />`);

    const outer = wrapper();
    const inner = line();
    expect(outer).toBeTruthy();
    expect(inner).toBeTruthy();
    expect(inner.parentElement).toBe(outer);
    expect(inner.children.length).toBe(0);
  });

  it('carries both the separator and horizontal classes', async () => {
    mounted = await mountAndFlush(html`<${Separator} />`);

    const classList = [...line().classList];
    expect(classList).toContain(String(styles.separator));
    expect(classList).toContain(String(styles.horizontal));
  });

  it('defaults space and padding to 0px', async () => {
    mounted = await mountAndFlush(html`<${Separator} />`);

    expect(wrapper().style.paddingLeft).toBe('0px');
    expect(wrapper().style.paddingRight).toBe('0px');
    expect(line().style.marginTop).toBe('0px');
    expect(line().style.marginBottom).toBe('0px');
  });

  it('maps space onto the vertical margins of the line', async () => {
    mounted = await mountAndFlush(html`<${Separator} space=${24} />`);

    expect(line().style.marginTop).toBe('24px');
    expect(line().style.marginBottom).toBe('24px');
    expect(wrapper().style.paddingLeft).toBe('0px');
  });

  it('maps padding onto the horizontal padding of the wrapper', async () => {
    mounted = await mountAndFlush(html`<${Separator} padding=${16} />`);

    expect(wrapper().style.paddingLeft).toBe('16px');
    expect(wrapper().style.paddingRight).toBe('16px');
    expect(line().style.marginTop).toBe('0px');
  });

  it('keeps an explicit 0 instead of falling back', async () => {
    mounted = await mountAndFlush(
      html`<${Separator} space=${0} padding=${0} />`
    );

    expect(wrapper().style.paddingLeft).toBe('0px');
    expect(line().style.marginTop).toBe('0px');
  });

  it('re-renders the inline styles when the props change', async () => {
    const state = observable({ space: 4, padding: 8 });
    const Wrapper: FC = () => () =>
      html`<${Separator} space=${state.space} padding=${state.padding} />`;

    mounted = await mountAndFlush(html`<${Wrapper} />`);
    expect(line().style.marginTop).toBe('4px');
    expect(wrapper().style.paddingLeft).toBe('8px');

    state.space = 12;
    state.padding = 20;
    await flush();

    expect(line().style.marginTop).toBe('12px');
    expect(line().style.marginBottom).toBe('12px');
    expect(wrapper().style.paddingLeft).toBe('20px');
    expect(wrapper().style.paddingRight).toBe('20px');
  });
});
