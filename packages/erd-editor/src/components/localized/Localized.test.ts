import { DOMTemplateLiterals, html, render } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import Localized, { localized } from '@/components/localized/Localized';
import { createI18n, I18n } from '@/i18n/translate';

let mounted: Mounted | null = null;
let teardown: (() => void) | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  teardown?.();
  teardown = null;
});

async function mountProvided(template: DOMTemplateLiterals, i18n: I18n) {
  const container = document.createElement('div');
  document.body.append(container);
  const provider = provideI18n(container, i18n);
  render(container, template);
  await flush();

  teardown = () => {
    render(container, null);
    provider.destroy();
    container.remove();
  };
  return container;
}

describe('Localized', () => {
  it('renders a key in English where nothing provides a language', async () => {
    mounted = await mountAndFlush(localized('common.toast.copied'));

    expect(mounted.container.textContent?.trim()).toBe('Copied!');
  });

  it('renders a key in the language provided above it', async () => {
    const container = await mountProvided(
      html`<${Localized} messageKey="common.close" />`,
      createTestI18n('ko-KR', pseudoMessages('ko'))
    );

    expect(container.textContent?.trim()).toBe('ko:Close');
  });

  it('renders again once another language is assigned into the one provided', async () => {
    const i18n = createTestI18n('en');
    const container = await mountProvided(
      localized('common.toast.couldNotPlaceTables'),
      i18n
    );
    expect(container.textContent?.trim()).toBe('Could not place tables');

    Object.assign(i18n, createI18n('ar-SA', pseudoMessages('ar')));
    await flush();

    expect(container.textContent?.trim()).toBe('ar:Could not place tables');
  });

  it('passes its parameters through to the message', async () => {
    const messages = {
      ...pseudoMessages('xx'),
      'common.close': 'Close {name} at {count}',
    };
    const container = await mountProvided(
      html`<${Localized}
        messageKey="common.close"
        .params=${{ name: 'users', count: 3 }}
      />`,
      createTestI18n('de-DE', messages)
    );

    expect(container.textContent?.trim()).toBe('Close users at 3');
  });
});
