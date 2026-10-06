import { FC, html, render } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import { localeContext, useI18n } from '@/components/localeContext';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';

let mounted: Mounted | null = null;
let teardown: (() => void) | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  teardown?.();
  teardown = null;
});

/** Prints what a component reads of the language where it stands. */
const Probe: FC<{}> = (props, ctx) => {
  const i18n = useI18n(ctx);

  return () =>
    html`<div class="probe" data-locale=${i18n.value.locale}>
      ${i18n.value.t('common.close')}
    </div>`;
};

/** A container with a language provided on it, as the editor's root provides one. */
async function mountProvided(i18n = createTestI18n('en')) {
  const container = document.createElement('div');
  document.body.append(container);
  const provider = provideI18n(container, i18n);
  render(container, html`<${Probe} />`);
  await flush();

  teardown = () => {
    render(container, null);
    provider.destroy();
    container.remove();
  };
  return { container, i18n };
}

const probeOf = (container: HTMLElement) =>
  container.querySelector('.probe') as HTMLElement;

describe('localeContext', () => {
  it('defaults to English', () => {
    expect(localeContext.value).toBe(sourceI18n);
  });

  it('hands a consumer with no provider English', async () => {
    mounted = await mountAndFlush(html`<${Probe} />`);

    const probe = probeOf(mounted.container);
    expect(probe.dataset.locale).toBe('en');
    expect(probe.textContent?.trim()).toBe('Close');
  });

  it('hands a consumer the language provided above it', async () => {
    const { container } = await mountProvided(
      createTestI18n('ko-KR', pseudoMessages('ko'))
    );

    expect(probeOf(container).dataset.locale).toBe('ko-KR');
    expect(probeOf(container).textContent?.trim()).toBe('ko:Close');
  });

  it('re-renders a consumer when another language is assigned in place', async () => {
    const { container, i18n } = await mountProvided();

    Object.assign(i18n, createI18n('ja-JP', pseudoMessages('ja')));
    await flush();

    expect(probeOf(container).dataset.locale).toBe('ja-JP');
    expect(probeOf(container).textContent?.trim()).toBe('ja:Close');
  });
});
