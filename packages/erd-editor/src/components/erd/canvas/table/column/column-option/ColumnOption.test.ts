import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ColumnOption, {
  ColumnOptionProps,
} from '@/components/erd/canvas/table/column/column-option/ColumnOption';
import * as styles from '@/components/erd/canvas/table/column/column-option/ColumnOption.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const baseProps = (): ColumnOptionProps => ({
  focus: false,
  width: 20,
  checked: false,
  text: 'UQ',
});

async function mountOption(props: Partial<ColumnOptionProps> = {}) {
  const merged = { ...baseProps(), ...props };
  mounted = await mountAndFlush(
    html`<${ColumnOption}
      class=${merged.class}
      focus=${merged.focus}
      width=${merged.width}
      checked=${merged.checked}
      text=${merged.text}
      title=${merged.title}
    />`
  );
  return mounted.container.querySelector(`.${styles.option}`) as HTMLDivElement;
}

describe('ColumnOption', () => {
  it('renders the label text inside the generated option class', async () => {
    const el = await mountOption({ text: 'AI' });

    expect(el).toBeTruthy();
    expect(el.textContent?.trim()).toBe('AI');
    expect(el.classList.contains(String(styles.option))).toBe(true);
  });

  it('pins both width and min-width to the width prop', async () => {
    const el = await mountOption({ width: 35 });

    expect(el.style.width).toBe('35px');
    expect(el.style.minWidth).toBe('35px');
  });

  it('omits focus and checked classes when both props are false', async () => {
    const el = await mountOption();

    expect(el.classList.contains('focus')).toBe(false);
    expect(el.classList.contains('checked')).toBe(false);
    expect(el.hasAttribute('data-focus-border-bottom')).toBe(false);
  });

  it('adds the focus class and the focus border attribute when focused', async () => {
    const el = await mountOption({ focus: true });

    expect(el.classList.contains('focus')).toBe(true);
    expect(el.hasAttribute('data-focus-border-bottom')).toBe(true);
  });

  it('adds the checked class independently of focus', async () => {
    const el = await mountOption({ checked: true });

    expect(el.classList.contains('checked')).toBe(true);
    expect(el.classList.contains('focus')).toBe(false);
  });

  it('can render focused and checked at the same time', async () => {
    const el = await mountOption({ focus: true, checked: true });

    expect(el.classList.contains('focus')).toBe(true);
    expect(el.classList.contains('checked')).toBe(true);
  });

  it('merges an extra class from the class prop', async () => {
    const el = await mountOption({ class: 'column-col' });

    expect(el.classList.contains('column-col')).toBe(true);
    expect(el.classList.contains(String(styles.option))).toBe(true);
  });

  it('accepts the class prop as an object map', async () => {
    const el = await mountOption({ class: { alpha: true, beta: false } });

    expect(el.classList.contains('alpha')).toBe(true);
    expect(el.classList.contains('beta')).toBe(false);
  });

  it('sets the tooltip from the title prop', async () => {
    const el = await mountOption({ title: 'Auto Increment' });

    expect(el.getAttribute('title')).toBe('Auto Increment');
  });

  it('reacts to prop changes without remounting', async () => {
    const state = observable({ focus: false, checked: false, text: 'UQ' });
    const Wrapper: FC<any> = () => () =>
      html`<${ColumnOption}
        focus=${state.focus}
        width=${20}
        checked=${state.checked}
        text=${state.text}
      />`;

    mounted = await mountAndFlush(html`<${Wrapper} />`);
    const el = mounted.container.querySelector(
      `.${styles.option}`
    ) as HTMLDivElement;

    expect(el.classList.contains('checked')).toBe(false);

    state.checked = true;
    state.focus = true;
    state.text = 'PK';
    await flush();

    expect(mounted.container.querySelector(`.${styles.option}`)).toBe(el);
    expect(el.classList.contains('checked')).toBe(true);
    expect(el.classList.contains('focus')).toBe(true);
    expect(el.textContent?.trim()).toBe('PK');
  });
});
