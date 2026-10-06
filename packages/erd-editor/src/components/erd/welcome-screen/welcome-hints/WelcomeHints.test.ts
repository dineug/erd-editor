import { html, observable, render } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestI18n,
  flush,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import { ARROW_DOWN } from '@/components/erd/welcome-screen/welcome-hints/hintArrows';
import WelcomeHints, {
  preferencesHintKey,
  WelcomeHintsProps,
} from '@/components/erd/welcome-screen/welcome-hints/WelcomeHints';
import { ARROW_UP_BOX } from '@/components/erd/welcome-screen/welcomeLayout';
import type { I18n } from '@/i18n/translate';

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

const REACH = ARROW_UP_BOX.width - ARROW_UP_BOX.tipX;

async function setup(initial: Partial<WelcomeHintsProps> = {}, i18n?: I18n) {
  const props = observable<WelcomeHintsProps>({
    search: null,
    preferences: null,
    width: 1000,
    ...initial,
  });
  const container = document.createElement('div');
  document.body.append(container);
  const provider = i18n ? provideI18n(container, i18n) : null;

  render(
    container,
    html`<${WelcomeHints}
      search=${props.search}
      preferences=${props.preferences}
      width=${props.width}
      enableThemeBuilder=${props.enableThemeBuilder}
      enableLocalePicker=${props.enableLocalePicker}
    />`
  );
  await flush();

  teardowns.push(() => {
    render(container, null);
    provider?.destroy();
    container.remove();
  });

  return {
    container,
    hint: (name: string) =>
      container.querySelector<HTMLElement>(`.welcome-screen-hint-${name}`),
  };
}

describe('preferencesHintKey', () => {
  it('names what the toolbar shows: both buttons, either one, or neither', () => {
    expect(preferencesHintKey(true, true)).toBe('welcome.hintThemeAndLanguage');
    expect(preferencesHintKey(true, false)).toBe('welcome.hintTheme');
    expect(preferencesHintKey(false, true)).toBe('welcome.hintLanguage');
    expect(preferencesHintKey(false, false)).toBeNull();
  });
});

describe('WelcomeHints', () => {
  it('draws the floating toolbar hint alone while no button was measured', async () => {
    const { container, hint } = await setup({ enableThemeBuilder: true });

    expect(container.querySelectorAll('.welcome-screen-hint')).toHaveLength(1);
    expect(hint('tools')?.textContent?.trim()).toBe(
      'Pan, zoom and draw relationships'
    );
    expect(
      Array.from(hint('tools')?.querySelectorAll('path') ?? []).map(path =>
        path.getAttribute('d')
      )
    ).toEqual([...ARROW_DOWN]);
  });

  it('labels the palette hint before its arrow and the preferences hint after its mirrored one', async () => {
    const { hint } = await setup({
      search: 343,
      preferences: 408,
      enableThemeBuilder: true,
      enableLocalePicker: true,
    });
    const palette = hint('palette')!;
    const preferences = hint('preferences')!;

    expect(palette.getAttribute('dir')).toBe('ltr');
    expect(palette.style.right).toBe(`${1000 - 343 - REACH}px`);
    expect(palette.style.left).toBe('');
    expect(palette.firstElementChild?.tagName.toLowerCase()).toBe('span');
    expect(palette.querySelector('span')?.style.textAlign).toBe('right');

    expect(preferences.style.left).toBe(`${408 - REACH}px`);
    expect(preferences.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(preferences.querySelector('span')?.style.textAlign).toBe('left');
    expect(preferences.textContent?.trim()).toBe('Pick a theme and a language');
  });

  it('draws no preferences hint while neither prop shows a button for it', async () => {
    const { hint } = await setup({ search: 343, preferences: 408 });

    expect(hint('palette')).not.toBeNull();
    expect(hint('preferences')).toBeNull();
  });

  it('reads its words and their direction from the language', async () => {
    const { hint } = await setup(
      { search: 657, enableLocalePicker: true, preferences: 592 },
      createTestI18n('he-IL', pseudoMessages('he'))
    );

    expect(hint('palette')?.querySelector('span')?.getAttribute('dir')).toBe(
      'rtl'
    );
    expect(hint('palette')?.style.left).toBe(`${657 - REACH}px`);
    expect(hint('preferences')?.style.right).toBe(`${1000 - 592 - REACH}px`);
    expect(hint('tools')?.textContent?.trim()).toBe(
      'he:Pan, zoom and draw relationships'
    );
  });
});
