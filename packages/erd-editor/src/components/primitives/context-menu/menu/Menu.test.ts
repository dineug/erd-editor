import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import Menu from '@/components/primitives/context-menu/menu/Menu';
import * as styles from '@/components/primitives/context-menu/menu/Menu.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('Menu', () => {
  it('renders the icon and the name in order', async () => {
    mounted = await mountAndFlush(html`<${Menu} icon=${'★'} name=${'Copy'} />`);

    const menu = mounted.container.querySelector(
      `.${String(styles.menu)}`
    ) as HTMLElement;
    expect(menu).toBeTruthy();

    const icon = menu.querySelector(`.${String(styles.icon)}`) as HTMLElement;
    expect(icon.textContent).toContain('★');
    expect(menu.textContent).toContain('Copy');
  });

  it('omits the right slot when the right prop is not given', async () => {
    mounted = await mountAndFlush(html`<${Menu} icon=${''} name=${'Paste'} />`);

    expect(
      mounted.container.querySelector(`.${String(styles.right)}`)
    ).toBeNull();
  });

  it('omits the right slot when the right prop is an empty string', async () => {
    mounted = await mountAndFlush(
      html`<${Menu} icon=${''} name=${'Paste'} right=${''} />`
    );

    expect(
      mounted.container.querySelector(`.${String(styles.right)}`)
    ).toBeNull();
  });

  it('renders the right slot when the right prop is given', async () => {
    mounted = await mountAndFlush(
      html`<${Menu} icon=${''} name=${'Undo'} right=${'Ctrl+Z'} />`
    );

    const right = mounted.container.querySelector(
      `.${String(styles.right)}`
    ) as HTMLElement;
    expect(right).toBeTruthy();
    expect(right.textContent).toContain('Ctrl+Z');
  });

  it('accepts template literals for icon, name and right', async () => {
    mounted = await mountAndFlush(
      html`<${Menu}
        icon=${html`<svg class="icon-svg"></svg>`}
        name=${html`<span class="name-span">Named</span>`}
        right=${html`<kbd class="right-kbd">K</kbd>`}
      />`
    );

    expect(mounted.container.querySelector('.icon-svg')).toBeTruthy();
    expect(
      (mounted.container.querySelector('.name-span') as HTMLElement).textContent
    ).toBe('Named');
    expect(mounted.container.querySelector('.right-kbd')).toBeTruthy();
  });
});
