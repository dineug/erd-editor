// AC-P3's resolver half. A dom scene read --erd-editor-* straight off the
// cascade and konva reads none, so what the cascade settled on has to be turned
// back into values here, and the turning has to survive a realm without a dom.

import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestTheme } from '@/__test-utils__';
import {
  fromThemeVariables,
  observeThemeOverrides,
  readThemeVariables,
  resolveHostTheme,
  resolveTheme,
} from '@/konva/theme';
import { type Theme, themeToTokensString } from '@/themes/tokens';

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

const track = <T extends { remove: () => void }>(node: T): T => {
  teardowns.push(() => node.remove());
  return node;
};

function appendStyle(css: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  return track(style);
}

/**
 * A host carrying the same declarations the editor's own Theme block emits, so
 * what the spec resolves off it went through the real var() fallback rather
 * than a shape written for the test.
 */
function mountThemedHost(theme: Theme): HTMLDivElement {
  appendStyle(`.theme-probe {\n${themeToTokensString(theme)}\n}`);

  const parent = document.createElement('div');
  const host = document.createElement('div');
  host.className = 'theme-probe';
  parent.append(host);
  document.body.append(track(parent));

  return host;
}

/** Lets a MutationObserver deliver, which it does on a microtask of its own. */
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('resolveTheme', () => {
  it('keeps the fallback for a token the reader has no answer for', () => {
    const fallback = createTestTheme();

    expect(resolveTheme(fallback, () => undefined)).toEqual(fallback);
  });

  it('takes the reader over the fallback, trimmed', () => {
    const fallback = createTestTheme();
    const resolved = resolveTheme(fallback, name =>
      name === '--table-background' ? '  #abcdef  ' : ''
    );

    expect(resolved.tableBackground).toBe('#abcdef');
    expect(resolved.memoBackground).toBe(fallback.memoBackground);
  });

  it('resolves off a posted record with no dom in reach', () => {
    const fallback = createTestTheme();
    const resolved = resolveTheme(
      fallback,
      fromThemeVariables({ '--key-fk': '#00ff00' })
    );

    expect(resolved.keyFK).toBe('#00ff00');
  });
});

describe('readThemeVariables', () => {
  it('captures what the cascade settled each token on', () => {
    const theme = createTestTheme();
    const host = mountThemedHost(theme);

    expect(readThemeVariables(host)['--table-background']).toBe(
      theme.tableBackground
    );
  });

  it('captures an outside --erd-editor-* override in its place', () => {
    const theme = createTestTheme();
    const host = mountThemedHost(theme);
    appendStyle('.theme-probe { --erd-editor-table-background: #abcdef; }');

    expect(readThemeVariables(host)['--table-background']).toBe('#abcdef');
  });
});

describe('resolveHostTheme', () => {
  it('hands the scene the override rather than the preset', () => {
    const theme = createTestTheme();
    const host = mountThemedHost(theme);
    appendStyle(
      '.theme-probe { --erd-editor-table-background: #abcdef; --erd-editor-key-fk: #fedcba; }'
    );

    const resolved = resolveHostTheme(host, theme);

    expect(resolved.tableBackground).toBe('#abcdef');
    expect(resolved.keyFK).toBe('#fedcba');
    expect(resolved.memoBackground).toBe(theme.memoBackground);
  });

  it('falls back to the preset where nothing above the host declares one', () => {
    const orphan = document.createElement('div');
    document.body.append(track(orphan));
    const theme = createTestTheme();

    expect(resolveHostTheme(orphan, theme)).toEqual(theme);
  });
});

describe('observeThemeOverrides', () => {
  it('fires when a stylesheet joins the document', async () => {
    const theme = createTestTheme();
    const host = mountThemedHost(theme);
    let calls = 0;
    teardowns.push(observeThemeOverrides(host, () => calls++));

    appendStyle('.theme-probe { --erd-editor-table-background: #abcdef; }');
    await settle();

    expect(calls).toBeGreaterThan(0);
  });

  it('fires when an ancestor swaps the class an override hangs on', async () => {
    const theme = createTestTheme();
    const host = mountThemedHost(theme);
    let calls = 0;
    teardowns.push(observeThemeOverrides(host, () => calls++));

    host.parentElement!.classList.add('dark');
    await settle();

    expect(calls).toBeGreaterThan(0);
  });

  it('stops firing once it is torn down', async () => {
    const theme = createTestTheme();
    const host = mountThemedHost(theme);
    let calls = 0;
    observeThemeOverrides(host, () => calls++)();

    appendStyle('.theme-probe { --erd-editor-table-background: #abcdef; }');
    host.setAttribute('style', 'color: red');
    await settle();

    expect(calls).toBe(0);
  });
});
