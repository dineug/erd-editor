import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import Switch, { SwitchProps } from '@/components/primitives/switch/Switch';
import * as styles from '@/components/primitives/switch/Switch.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function setup(props: Partial<SwitchProps> = {}) {
  const onChange = vi.fn();
  mounted = await mountAndFlush(
    html`<${Switch}
      size=${props.size}
      value=${props.value ?? false}
      .onChange=${props.onChange ?? onChange}
    />`
  );

  const button = mounted.container.querySelector('button') as HTMLButtonElement;
  const thumb = button.querySelector('span') as HTMLSpanElement;

  return { button, thumb, onChange };
}

describe('Switch', () => {
  it('renders a non submitting button wrapping a thumb span', async () => {
    const { button, thumb } = await setup();

    expect(button.getAttribute('type')).toBe('button');
    expect(thumb).toBeTruthy();
    expect(thumb.classList.contains(String(styles.switchThumb))).toBe(true);
  });

  it('always applies the base switchButton class', async () => {
    const { button } = await setup();

    expect(button.classList.contains(String(styles.switchButton))).toBe(true);
  });

  it('falls back to the size2 variant when size is omitted', async () => {
    const { button } = await setup();

    expect(button.classList.contains(String(styles.size2))).toBe(true);
    expect(button.classList.contains(String(styles.size1))).toBe(false);
    expect(button.classList.contains(String(styles.size3))).toBe(false);
  });

  it.each([
    ['1', 'size1'],
    ['2', 'size2'],
    ['3', 'size3'],
  ] as const)('maps size "%s" to the %s class', async (size, key) => {
    const { button } = await setup({ size });

    expect(button.classList.contains(String(Reflect.get(styles, key)))).toBe(
      true
    );
  });

  it('reflects a checked value onto both the button attribute and the thumb flag', async () => {
    const { button, thumb } = await setup({ value: true });

    expect(button.getAttribute('data-checked')).toBe('true');
    expect(thumb.hasAttribute('data-checked')).toBe(true);
  });

  it('reflects an unchecked value and drops the boolean thumb flag', async () => {
    const { button, thumb } = await setup({ value: false });

    expect(button.getAttribute('data-checked')).toBe('false');
    expect(thumb.hasAttribute('data-checked')).toBe(false);
  });

  it('toggles an unchecked switch on', async () => {
    const { button, onChange } = await setup({ value: false });

    button.click();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles a checked switch off', async () => {
    const { button, onChange } = await setup({ value: true });

    button.click();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('reports the same next value for every click while the prop stays put', async () => {
    const { button, onChange } = await setup({ value: false });

    button.click();
    button.click();

    expect(onChange.mock.calls).toEqual([[true], [true]]);
  });

  it('re-renders the checked state when the value prop changes', async () => {
    const { button, thumb } = await setup({ value: false });

    mounted?.unmount();
    mounted = await mountAndFlush(
      html`<${Switch} value=${true} .onChange=${() => {}} />`
    );
    const next = mounted.container.querySelector('button') as HTMLButtonElement;

    expect(button.getAttribute('data-checked')).toBe('false');
    expect(thumb.hasAttribute('data-checked')).toBe(false);
    expect(next.getAttribute('data-checked')).toBe('true');
  });
});
