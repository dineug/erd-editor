// The lock rows laid out in a real Chromium: the names share one column, as
// wide as the longest name, while each value keeps its button beside it.

import { addCSSHost, html, render, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush, provideI18n } from '@/__test-utils__';
import { appContext } from '@/components/appContext';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import Settings from '@/components/settings/Settings';
import * as styles from '@/components/settings/Settings.styles';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { messagesOf } from '@/i18n/messages';
import { createI18n } from '@/i18n/translate';

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

/** Mounts the tab where its stylesheets are live, over a file whose locks are off and whose view is far out, in the language given. */
async function setup(locale?: 'de-DE') {
  const app = createTestAppContext();
  app.store.dispatchSync(
    initialLoadJsonAction$(
      JSON.stringify({
        version: '3.0.0',
        settings: {
          lockSettings: 0,
          zoomLevel: 1.5,
          originX: -1234,
          originY: -3456,
        },
      })
    )
  );
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const globals = document.createElement('div');
  const root = document.createElement('div');
  root.setAttribute('style', 'width: 900px; height: 700px;');
  shadow.append(globals, root);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider = useProvider(root as any, appContext, app);
  const language = locale
    ? provideI18n(root, createI18n(locale, messagesOf(locale)))
    : null;
  render(globals, html`<${GlobalStyles} />`);
  render(root, html`<${Settings} />`);

  teardowns.push(() => {
    render(root, null);
    render(globals, null);
    language?.destroy();
    provider.destroy();
    host.remove();
  });
  await flush();

  return Array.from(root.querySelectorAll(`.${styles.lockRow}`)).map(row => {
    const name = row.querySelector(`.${styles.lockName}`) as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(name);
    return {
      name: name.getBoundingClientRect(),
      nameText: range.getBoundingClientRect(),
      value: row.querySelector(`.${styles.lockValue}`) as HTMLElement,
      button: row.querySelector('button')!.getBoundingClientRect(),
    };
  });
}

describe('Settings lock rows in the browser', () => {
  it("moves only a long value's own button along, the names sharing one column", async () => {
    const rows = await setup();
    const [view, ...rest] = rows;
    const start = view.name.left;
    const column = view.name.width;
    // The font the platform resolves sets the longest English name, which
    // fits 140px on a Mac and runs past it in the Linux CI fonts.
    const longest = Math.max(...rows.map(row => row.nameText.width));

    expect(column).toBeCloseTo(Math.max(140, longest + 12), 0);
    expect(view.value.textContent?.trim()).toBe('150% · -1.2k, -3.5k');
    expect(view.value.getBoundingClientRect().width).toBeGreaterThan(120);
    for (const row of rows) {
      expect(row.name.width).toBe(column);
      expect(row.value.getBoundingClientRect().left).toBe(start + column);
    }
    for (const row of rest) {
      expect(row.button.left).toBe(start + column + 120 + 8);
    }
    expect(view.button.left).toBeGreaterThan(start + column + 120 + 8);
  });

  it('widens the names to the longest in a longer language, so no name runs into its value', async () => {
    const rows = await setup('de-DE');
    const valueStart = rows[0].value.getBoundingClientRect().left;

    expect(rows[0].name.width).toBeGreaterThan(140);
    for (const row of rows) {
      expect(row.value.getBoundingClientRect().left).toBe(valueStart);
      expect(row.nameText.right).toBeLessThanOrEqual(valueStart);
    }
  });
});
