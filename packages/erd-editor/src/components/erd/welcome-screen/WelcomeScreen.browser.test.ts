// Where the welcome screen's arrows land and what a pointer over it reaches,
// laid out by its real stylesheets in a shadow root as the element has one,
// under a toolbar whose buttons stand where the real one puts them.

import { addCSSHost, html, render, useProvider } from '@dineug/r-html';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestI18n,
  createTestTheme,
  flush,
  provideI18n,
} from '@/__test-utils__';
import { appContext } from '@/components/appContext';
import Erd from '@/components/erd/Erd';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import { themeContext } from '@/components/themeContext';
import { TOOLBAR_HEIGHT } from '@/constants/layout';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import type { LocaleCode } from '@/i18n/locales';
import { whenDrawn } from '@/konva/batchDraw';
import { InternalEventType } from '@/utils/internalEvents';

const WIDTH = 1000;
const HEIGHT = 760;

/** How far off its anchor an arrow's tip may land, for the stroke's rounding. */
const TOLERANCE = 2;

const teardowns: Array<() => void> = [];

// The runner's frame is narrower than the canvas the hints take room on.
beforeAll(() => page.viewport(WIDTH + 100, HEIGHT + 100));

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const TOOLBAR_STYLE = `display: flex; align-items: center; height: ${TOOLBAR_HEIGHT}px; min-height: ${TOOLBAR_HEIGHT}px; padding: 0 15px;`;

/** A toolbar laid out as the real one is, its three buttons where the hints point. */
const toolbar = html`<div class="toolbar" style=${TOOLBAR_STYLE}>
  <div style="flex: none; width: 300px; height: 100%;"></div>
  <div
    class="toolbar-search"
    style="flex: none; width: 26px; height: 100%;"
  ></div>
  <div style="flex: none; width: 26px; height: 100%;"></div>
  <div
    class="toolbar-theme"
    style="flex: none; width: 26px; height: 100%;"
  ></div>
  <div
    class="toolbar-locale"
    style="flex: none; width: 26px; height: 100%;"
  ></div>
</div>`;

async function setup(locale: LocaleCode) {
  const app = createTestAppContext();
  const i18n = createTestI18n(locale);

  const host = document.createElement('div');
  host.setAttribute(
    'style',
    `display: block; width: ${WIDTH}px; height: ${HEIGHT}px;`
  );
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const globals = document.createElement('div');
  const container = document.createElement('div');
  container.setAttribute('style', 'width: 100%; height: 100%;');
  shadow.append(globals, container);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  const providers = [
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    useProvider(container as any, appContext, app),
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    useProvider(container as any, themeContext, createTestTheme()),
    provideI18n(container, i18n),
  ];

  app.store.dispatchSync(
    changeViewportAction({ width: WIDTH, height: HEIGHT - TOOLBAR_HEIGHT })
  );
  render(globals, html`<${GlobalStyles} />`);
  render(
    container,
    html`<div
      class="root"
      dir=${i18n.dir}
      style="display: flex; flex-direction: column; width: 100%; height: 100%;"
    >
      ${toolbar}
      <div style="position: relative; flex: 1; min-height: 0; display: flex;">
        <${Erd}
          isDarkMode=${false}
          mouseTracking=${false}
          readonly=${false}
          enableWelcomeScreen=${true}
          enableThemeBuilder=${true}
          enableLocalePicker=${true}
        />
      </div>
    </div>`
  );
  await flush();
  await whenDrawn();
  await flush();

  teardowns.push(() => {
    render(container, null);
    render(globals, null);
    providers.forEach(provider => provider.destroy());
    host.remove();
  });

  const box = (selector: string) =>
    shadow.querySelector(selector)!.getBoundingClientRect();

  return {
    app,
    host,
    shadow,
    box,
    centerX: (selector: string) => {
      const { left, width } = box(selector);
      return left + width / 2;
    },
  };
}

/** Where an arrow's shaft ends on screen, which is where its barbs meet: the tip. */
function tipOf(hint: Element): DOMPoint {
  const shaft = hint.querySelector(
    '.welcome-screen-arrow path'
  ) as SVGPathElement;
  const end = shaft.getPointAtLength(shaft.getTotalLength());
  return new DOMPoint(end.x, end.y).matrixTransform(shaft.getScreenCTM()!);
}

describe.each<LocaleCode>(['en', 'ar-SA'])('WelcomeScreen in %s', locale => {
  it('lands each toolbar arrow tip on its button, just under the bar', async () => {
    const { shadow, box, centerX } = await setup(locale);
    const bar = box('.toolbar');
    const palette = tipOf(
      shadow.querySelector('.welcome-screen-hint-palette')!
    );
    const preferences = tipOf(
      shadow.querySelector('.welcome-screen-hint-preferences')!
    );
    const between =
      (centerX('.toolbar-theme') + centerX('.toolbar-locale')) / 2;

    expect(
      Math.abs(palette.x - centerX('.toolbar-search'))
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(preferences.x - between)).toBeLessThanOrEqual(TOLERANCE);
    for (const tip of [palette, preferences]) {
      expect(tip.y).toBeGreaterThan(bar.bottom);
      expect(tip.y).toBeLessThan(bar.bottom + 12);
    }
  });

  it('puts the palette label on the side the text starts and the preferences label on the other', async () => {
    const { box } = await setup(locale);
    const paletteLabel = box('.welcome-screen-hint-palette span');
    const paletteArrow = box('.welcome-screen-hint-palette svg');
    const preferencesLabel = box('.welcome-screen-hint-preferences span');
    const preferencesArrow = box('.welcome-screen-hint-preferences svg');

    if (locale === 'en') {
      expect(paletteLabel.right).toBeLessThanOrEqual(paletteArrow.left + 1);
      expect(preferencesLabel.left).toBeGreaterThanOrEqual(
        preferencesArrow.right - 1
      );
    } else {
      expect(paletteLabel.left).toBeGreaterThanOrEqual(paletteArrow.right - 1);
      expect(preferencesLabel.right).toBeLessThanOrEqual(
        preferencesArrow.left + 1
      );
    }
  });

  it('keeps the floating toolbar hint over the bar, its tip on the bar centre', async () => {
    const { shadow, box, centerX } = await setup(locale);
    const tools = shadow.querySelector('.welcome-screen-hint-tools')!;
    const bar = box('.floating-toolbar');
    const tip = tipOf(tools);

    expect(tools.getBoundingClientRect().bottom).toBeLessThanOrEqual(bar.top);
    expect(Math.abs(tip.x - centerX('.floating-toolbar'))).toBeLessThanOrEqual(
      TOLERANCE
    );
  });

  it('hands a pointer over the heading to the stage, and one over a row to the row', async () => {
    const { shadow, box } = await setup(locale);
    const heading = box('.welcome-screen-heading');
    const item = shadow.querySelector('.welcome-screen-item')!;
    const row = item.getBoundingClientRect();

    const underHeading = shadow.elementFromPoint(
      heading.left + heading.width / 2,
      heading.top + heading.height / 2
    );
    const underRow = shadow.elementFromPoint(
      row.left + row.width / 2,
      row.top + row.height / 2
    );

    expect(underHeading).not.toBeNull();
    expect(underRow).not.toBeNull();
    expect(underHeading!.closest('[data-testid="erd-canvas"]')).not.toBeNull();
    expect(underRow!.closest('.welcome-screen-item')).toBe(item);
  });
});

describe('WelcomeScreen focus', () => {
  it('hands the keyboard back when a table added under a focused row takes the screen away', async () => {
    const { app, host, shadow } = await setup('en');
    const onFocus = vi.fn();
    host.addEventListener(InternalEventType.focus, onFocus);
    teardowns.push(() =>
      host.removeEventListener(InternalEventType.focus, onFocus)
    );

    shadow.querySelector<HTMLElement>('.welcome-screen-item')!.focus();
    app.store.dispatchSync(addTableAction$());
    await flush();
    await flush();

    expect(shadow.querySelector('.welcome-screen')).toBeNull();
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
