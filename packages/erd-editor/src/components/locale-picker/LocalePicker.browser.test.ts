// The picker laid out in a real Chromium: a list taller than a short editor
// scrolls inside the panel, which stays inside the editor, and opening brings
// the checked row into view with the keyboard on it.

import { addCSSHost, html, render, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__';
import { appContext } from '@/components/appContext';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import LocalePicker from '@/components/locale-picker/LocalePicker';
import type { LocaleOption } from '@/i18n/locales';
import { openLocalePickerAction } from '@/utils/emitter';

/** The height of the editor the spec opens the picker in, short of the list's own. */
const HOST_HEIGHT = 300;

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

/**
 * Mounts the picker where its stylesheets are live, in a shadow root as the
 * element has one, inside a root sized and positioned as the editor's is.
 */
async function setup(option: LocaleOption) {
  const app = createTestAppContext();
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const globals = document.createElement('div');
  const root = document.createElement('div');
  root.setAttribute(
    'style',
    `position: relative; width: 600px; height: ${HOST_HEIGHT}px; overflow: hidden;`
  );
  shadow.append(globals, root);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider = useProvider(root as any, appContext, app);
  render(globals, html`<${GlobalStyles} />`);
  render(root, html`<${LocalePicker} option=${option} systemLocale=${'en'} />`);

  teardowns.push(() => {
    render(root, null);
    render(globals, null);
    provider.destroy();
    host.remove();
  });

  app.emitter.emit(openLocalePickerAction());
  await flush();

  const panel = shadow.querySelector('.locale-picker') as HTMLElement;
  const list = panel.querySelector('[role="listbox"]') as HTMLElement;
  return { shadow, root, panel, list };
}

describe('LocalePicker in the browser', () => {
  it('opens on a row below the fold scrolled into view, with the keyboard on it', async () => {
    const { shadow, list } = await setup('zh-TW');
    const row = list.querySelector(
      'button[data-locale="zh-TW"]'
    ) as HTMLButtonElement;

    expect(shadow.activeElement).toBe(row);
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    expect(list.scrollTop).toBeGreaterThan(0);

    const rowBox = row.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();
    expect(rowBox.top).toBeGreaterThanOrEqual(listBox.top);
    expect(rowBox.bottom).toBeLessThanOrEqual(listBox.bottom);
  });

  it('keeps System and its rule pinned in view over a list scrolled far down, clear of the checked row', async () => {
    const { shadow, list } = await setup('ko-KR');
    const system = list.querySelector(
      'button[data-locale="system"]'
    ) as HTMLButtonElement;
    const pinned = system.parentElement as HTMLElement;
    const checked = list.querySelector(
      'button[data-locale="ko-KR"]'
    ) as HTMLButtonElement;

    expect(list.scrollTop).toBeGreaterThan(0);
    const listBox = list.getBoundingClientRect();
    const systemBox = system.getBoundingClientRect();
    expect(systemBox.top).toBe(listBox.top);
    expect(pinned.getBoundingClientRect().height).toBe(41);
    expect(checked.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      pinned.getBoundingClientRect().bottom
    );
    const hit = shadow.elementFromPoint(systemBox.left + 4, systemBox.top + 4);
    expect(system.contains(hit)).toBe(true);
  });

  it('keeps the panel inside the editor, its rows 32px high', async () => {
    const { root, panel, list } = await setup('zh-TW');
    const rootBox = root.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();

    expect(panelBox.bottom).toBeLessThanOrEqual(rootBox.bottom);
    expect(panelBox.top - rootBox.top).toBe(46);
    expect(panelBox.left - rootBox.left).toBe(16);
    expect(panelBox.width).toBe(260);
    expect(root.scrollTop).toBe(0);
    for (const row of list.querySelectorAll('button')) {
      expect(row.getBoundingClientRect().height).toBe(32);
    }
  });

  it('opens on the first row with nothing to scroll when System is checked', async () => {
    const { shadow, list } = await setup('system');

    expect(shadow.activeElement).toBe(
      list.querySelector('button[data-locale="system"]')
    );
    expect(list.scrollTop).toBe(0);
  });

  it('hangs from the right in a right-to-left editor', async () => {
    const { root, panel } = await setup('ar-SA');
    root.dir = 'rtl';
    await flush();

    const rootBox = root.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    expect(rootBox.right - panelBox.right).toBe(16);
  });
});
