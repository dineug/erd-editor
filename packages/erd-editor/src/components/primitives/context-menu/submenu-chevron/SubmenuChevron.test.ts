import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { iconNameOf } from '@/__test-utils__/icon';
import {
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import SubmenuChevron from '@/components/primitives/context-menu/submenu-chevron/SubmenuChevron';
import { createI18n } from '@/i18n/translate';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const turn = () =>
  (mounted!.container.querySelector('.icon') as HTMLElement).style.transform;

describe('SubmenuChevron', () => {
  it('points right where nothing provides a language', async () => {
    mounted = await mountAndFlush(html`<${SubmenuChevron} />`);

    expect(iconNameOf(mounted.container)).toBe('chevron-right');
    expect(turn()).toBe('rotate(0deg)');
  });

  it('points left for a right-to-left reader, following a switch', async () => {
    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);
    try {
      mounted = await mountAndFlush(html`<${SubmenuChevron} />`);
      expect(turn()).toBe('rotate(0deg)');

      Object.assign(i18n, createI18n('he-IL', pseudoMessages('he')));
      await flush();
      expect(turn()).toBe('rotate(180deg)');
    } finally {
      provider.destroy();
    }
  });
});
