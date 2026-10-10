import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import ContextMenuSeparator from '@/components/primitives/context-menu/context-menu-separator/ContextMenuSeparator';
import * as styles from '@/components/primitives/context-menu/context-menu-separator/ContextMenuSeparator.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('ContextMenuSeparator', () => {
  it('renders one empty rule a reader announces as a separator', async () => {
    mounted = await mountAndFlush(html`<${ContextMenuSeparator} />`);

    const rules = mounted.container.querySelectorAll('[role="separator"]');
    expect(rules).toHaveLength(1);

    const rule = rules[0] as HTMLElement;
    expect(rule.tagName).toBe('DIV');
    expect(rule.classList.contains('context-menu-separator')).toBe(true);
    expect(rule.classList.contains(String(styles.separator))).toBe(true);
    expect(rule.childNodes).toHaveLength(0);
    expect(rule.textContent).toBe('');
  });

  it('carries no data-id, so no row takes it for the menu it sits in', async () => {
    mounted = await mountAndFlush(html`<${ContextMenuSeparator} />`);

    const rule = mounted.container.querySelector(
      '[role="separator"]'
    ) as HTMLElement;
    expect(rule.hasAttribute('data-id')).toBe(false);
  });
});
