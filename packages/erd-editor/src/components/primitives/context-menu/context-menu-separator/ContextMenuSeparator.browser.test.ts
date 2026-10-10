// The rule laid out in a real Chromium, in its stylesheets in a shadow root as
// the element has one: it keeps its pixel and its clearance in a menu cut to a
// short window, and stays drawn when the system forces its own colors.

import { addCSSHost, FC, html, render } from '@dineug/r-html';
import { afterEach, beforeAll, describe, expect, it } from 'vite-plus/test';
import { cdp, page } from 'vite-plus/test/browser/context';

import { flush } from '@/__test-utils__';
import * as itemStyles from '@/components/primitives/context-menu/context-menu-item/ContextMenuItem.styles';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';

/** A window shorter than the menu, which then scrolls inside it. */
const WINDOW = { width: 400, height: 300 };

/** The dark theme's slate steps 2 and 6, the tokens' defaults. */
const TOKENS =
  '--context-menu-background: #18191b; --context-menu-border: #363a3f;';

/** The one CDP command the spec sends, which the provider's session types only under its own config. */
type MediaSession = {
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
};

const session = () => cdp() as unknown as MediaSession;

const teardowns: Array<() => void | Promise<unknown>> = [];

beforeAll(() => page.viewport(WINDOW.width, WINDOW.height));

afterEach(async () => {
  for (const teardown of teardowns.splice(0)) await teardown();
});

const rows = (names: string[]) =>
  names.map(name => html`<${ContextMenu.Item} children=${name} />`);

/** An open menu of ten rows, a rule, five rows, a rule and five rows, taller than the window. */
const Host: FC = (props, ctx) => {
  const api = useContextMenuRootProvider(ctx);
  api.state.show = true;

  return () => html`
    <${ContextMenu.Root}
      children=${html`
        ${rows(Array.from({ length: 10 }, (_, i) => `A${i}`))}
        <${ContextMenu.Separator} />
        ${rows(Array.from({ length: 5 }, (_, i) => `B${i}`))}
        <${ContextMenu.Separator} />
        ${rows(Array.from({ length: 5 }, (_, i) => `C${i}`))}
      `}
    />
  `;
};

/** The color a rule paints its line in: its border's, else its background's. */
function paintOf(rule: HTMLElement): string {
  const style = getComputedStyle(rule);

  return style.borderTopStyle !== 'none' && style.borderTopWidth !== '0px'
    ? style.borderTopColor
    : style.backgroundColor;
}

async function openMenu() {
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const root = document.createElement('div');
  root.setAttribute('style', TOKENS);
  shadow.append(root);
  render(root, html`<${Host} />`);

  teardowns.push(() => {
    render(root, null);
    host.remove();
  });
  await flush();

  const content = shadow.querySelector('.context-menu-content') as HTMLElement;
  const rules = Array.from(
    content.querySelectorAll<HTMLElement>(':scope > [role="separator"]')
  );
  return { content, rules };
}

describe('ContextMenuSeparator in a real browser', () => {
  it('keeps its pixel and 4px either side in a menu cut to a short window', async () => {
    const { content, rules } = await openMenu();

    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    expect(rules).toHaveLength(2);

    for (const rule of rules) {
      const prev = rule.previousElementSibling as HTMLElement;
      const next = rule.nextElementSibling as HTMLElement;
      expect(prev.classList.contains(String(itemStyles.item))).toBe(true);
      expect(next.classList.contains(String(itemStyles.item))).toBe(true);

      const box = rule.getBoundingClientRect();
      expect(box.height).toBe(1);
      expect(box.top - prev.getBoundingClientRect().bottom).toBe(4);
      expect(next.getBoundingClientRect().top - box.bottom).toBe(4);
    }
  });

  it('spans the width of a row, which its highlight fills', async () => {
    const { rules } = await openMenu();

    for (const rule of rules) {
      const row = (
        rule.previousElementSibling as HTMLElement
      ).getBoundingClientRect();
      const box = rule.getBoundingClientRect();
      expect(box.left).toBe(row.left);
      expect(box.width).toBe(row.width);
    }
  });

  it('draws in the menu border token, apart from the menu background', async () => {
    const { content, rules } = await openMenu();

    expect(paintOf(rules[0])).toBe('rgb(54, 58, 63)');
    expect(getComputedStyle(content).backgroundColor).toBe('rgb(24, 25, 27)');
  });

  it('stays drawn when the system forces its own colors', async () => {
    await session().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    });
    teardowns.push(() =>
      session().send('Emulation.setEmulatedMedia', { features: [] })
    );
    expect(matchMedia('(forced-colors: active)').matches).toBe(true);

    const { content, rules } = await openMenu();
    const background = getComputedStyle(content).backgroundColor;

    for (const rule of rules) {
      expect(paintOf(rule)).not.toBe(background);
      expect(rule.getBoundingClientRect().height).toBe(1);
    }
  });
});
