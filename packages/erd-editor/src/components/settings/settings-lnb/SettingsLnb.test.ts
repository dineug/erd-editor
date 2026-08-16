import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import SettingsLnb, {
  Lnb,
} from '@/components/settings/settings-lnb/SettingsLnb';
import * as styles from '@/components/settings/settings-lnb/SettingsLnb.styles';
import { fontSize6 } from '@/styles/typography.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const items = () =>
  Array.from<HTMLDivElement>(
    mounted!.container.querySelectorAll(`.${styles.item}`)
  );

async function setup(value: Lnb = Lnb.preferences, onChange = vi.fn()) {
  mounted = await mountAndFlush(
    html`<${SettingsLnb} value=${value} .onChange=${onChange} />`
  );
  return { ...mounted, onChange };
}

describe('SettingsLnb', () => {
  it('exposes the two settings panels as the Lnb enum', () => {
    expect(Lnb).toEqual({
      preferences: 'Preferences',
      shortcuts: 'Shortcuts',
    });
  });

  it('renders a titled scrollable list of every Lnb value', async () => {
    const { container } = await setup();

    const root = container.querySelector(`.${styles.lnb}`) as HTMLDivElement;
    expect(root).toBeTruthy();

    const title = root.querySelector(`.${fontSize6}`) as HTMLDivElement;
    expect(title.textContent).toBe('Settings');

    const list = root.querySelector(`.${styles.list}`) as HTMLDivElement;
    expect(list.getAttribute('class')).toContain('scrollbar');

    expect(items().map(el => el.textContent?.trim())).toEqual([
      'Preferences',
      'Shortcuts',
    ]);
  });

  it('marks only the item matching `value` as selected', async () => {
    await setup(Lnb.preferences);

    const [preferences, shortcuts] = items();
    expect(preferences.classList.contains('selected')).toBe(true);
    expect(shortcuts.classList.contains('selected')).toBe(false);
  });

  it('moves the selected class when `value` is the other panel', async () => {
    await setup(Lnb.shortcuts);

    const [preferences, shortcuts] = items();
    expect(preferences.classList.contains('selected')).toBe(false);
    expect(shortcuts.classList.contains('selected')).toBe(true);
  });

  it('calls onChange with the clicked panel name', async () => {
    const { onChange } = await setup(Lnb.preferences);

    items()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(Lnb.shortcuts);

    items()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(Lnb.preferences);
  });

  it('re-renders the selection when the parent feeds back a new value', async () => {
    const Host: FC<{}> = () => {
      const state = observable({ value: Lnb.preferences as Lnb });
      const onChange = (value: Lnb) => {
        state.value = value;
      };

      return () =>
        html`<${SettingsLnb} value=${state.value} .onChange=${onChange} />`;
    };

    mounted = await mountAndFlush(html`<${Host} />`);

    expect(items()[0].classList.contains('selected')).toBe(true);

    items()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(items()[0].classList.contains('selected')).toBe(false);
    expect(items()[1].classList.contains('selected')).toBe(true);
  });
});
