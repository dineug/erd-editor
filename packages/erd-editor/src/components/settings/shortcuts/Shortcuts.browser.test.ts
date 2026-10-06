// The shortcut table laid out in a real Chromium, where a key cap, a block
// that reads left to right, sits at the start of its cell in either direction.

import { addCSSHost, html, render, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__';
import { appContext } from '@/components/appContext';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import Shortcuts from '@/components/settings/shortcuts/Shortcuts';

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

/** Mounts the table where its stylesheets are live, in a shadow root as the element has one, under a root of that direction. */
async function setup(dir: 'ltr' | 'rtl') {
  const app = createTestAppContext();
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const globals = document.createElement('div');
  const root = document.createElement('div');
  root.dir = dir;
  root.setAttribute('style', 'width: 800px;');
  shadow.append(globals, root);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider = useProvider(root as any, appContext, app);
  render(globals, html`<${GlobalStyles} />`);
  render(root, html`<${Shortcuts} />`);

  teardowns.push(() => {
    render(root, null);
    render(globals, null);
    provider.destroy();
    host.remove();
  });
  await flush();

  const header = root.querySelectorAll('th')[1] as HTMLElement;
  const cell = root.querySelector('tbody td:nth-child(2)') as HTMLElement;
  const kbd = cell.querySelector('.kbd') as HTMLElement;
  return { header, cell, kbd };
}

/** Where a cell's content box begins on the line's start side. */
const contentStart = (cell: HTMLElement, dir: 'ltr' | 'rtl') => {
  const box = cell.getBoundingClientRect();
  return dir === 'rtl' ? box.right - 12 : box.left + 12;
};

describe('Shortcuts in the browser', () => {
  it('starts each key cap under its heading in a left-to-right page', async () => {
    const { cell, kbd } = await setup('ltr');

    expect(kbd.getBoundingClientRect().left).toBe(contentStart(cell, 'ltr'));
  });

  it('starts each key cap at the right of its cell, under its heading, in a right-to-left page', async () => {
    const { header, cell, kbd } = await setup('rtl');
    const keys = kbd.getBoundingClientRect();

    expect(kbd.getAttribute('dir')).toBe('ltr');
    expect(keys.right).toBe(contentStart(cell, 'rtl'));
    expect(keys.right).toBe(contentStart(header, 'rtl'));
    expect(keys.width).toBeLessThan(cell.getBoundingClientRect().width / 2);
  });
});
