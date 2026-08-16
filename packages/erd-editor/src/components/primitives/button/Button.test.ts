import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Button from '@/components/primitives/button/Button';
import * as styles from '@/components/primitives/button/Button.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const getButton = () =>
  mounted!.container.querySelector('button') as HTMLButtonElement;

describe('Button', () => {
  it('renders a type="button" element carrying the text', async () => {
    mounted = await mountAndFlush(html`<${Button} text=${'Save'} />`);

    const button = getButton();
    expect(button).toBeTruthy();
    expect(button.getAttribute('type')).toBe('button');
    expect(button.textContent?.trim()).toBe('Save');
  });

  it('falls back to the solid variant and size 2', async () => {
    mounted = await mountAndFlush(html`<${Button} text=${'Save'} />`);

    const classList = [...getButton().classList];
    expect(classList).toContain(String(styles.button));
    expect(classList).toContain(String(styles.solid));
    expect(classList).toContain(String(styles.size2));
    expect(classList).not.toContain(String(styles.soft));
  });

  it('applies the soft variant class when asked', async () => {
    mounted = await mountAndFlush(
      html`<${Button} text=${'Save'} variant=${'soft'} />`
    );

    const classList = [...getButton().classList];
    expect(classList).toContain(String(styles.soft));
    expect(classList).not.toContain(String(styles.solid));
  });

  it.each([
    ['1', () => styles.size1],
    ['2', () => styles.size2],
    ['3', () => styles.size3],
  ] as const)('maps size %s onto its size class', async (size, expected) => {
    mounted = await mountAndFlush(
      html`<${Button} text=${'Save'} size=${size} />`
    );

    expect([...getButton().classList]).toContain(String(expected()));
  });

  it('renders a nested template as the text', async () => {
    mounted = await mountAndFlush(
      html`<${Button} text=${html`<span class="icon">x</span>`} />`
    );

    const icon = getButton().querySelector('.icon');
    expect(icon).toBeTruthy();
    expect(icon?.textContent).toBe('x');
  });

  it('invokes onClick with the click event', async () => {
    const onClick = vi.fn();
    mounted = await mountAndFlush(
      html`<${Button} text=${'Save'} .onClick=${onClick} />`
    );
    await flush();

    getButton().click();
    await flush();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0].type).toBe('click');
  });

  it('ignores an `onClick` prop that is not passed as a property binding', async () => {
    const onClick = vi.fn();
    mounted = await mountAndFlush(
      html`<${Button} text=${'Save'} onClick=${onClick} />`
    );
    await flush();

    getButton().click();
    await flush();

    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not throw when clicked without an onClick handler', async () => {
    mounted = await mountAndFlush(html`<${Button} text=${'Save'} />`);

    expect(() => getButton().click()).not.toThrow();
  });

  it('re-renders the class list and text when the props change', async () => {
    const state = observable({ variant: 'solid', text: 'Save' });
    const Wrapper: FC = () => () =>
      html`<${Button} text=${state.text} variant=${state.variant} />`;

    mounted = await mountAndFlush(html`<${Wrapper} />`);
    expect([...getButton().classList]).toContain(String(styles.solid));
    expect(getButton().textContent?.trim()).toBe('Save');

    state.variant = 'soft';
    state.text = 'Cancel';
    await flush();

    expect([...getButton().classList]).toContain(String(styles.soft));
    expect([...getButton().classList]).not.toContain(String(styles.solid));
    expect(getButton().textContent?.trim()).toBe('Cancel');
  });
});
