import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { CSS } from '@/template/css';

type Registry = typeof import('@/template/vCSSStyleSheet');

let css: CSS;
let registry: Registry;

const ownSheet = (cssText: string): CSSStyleSheet => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  return sheet;
};

/** css and the registry, in a module registry of their own so no host leaks between tests. */
beforeEach(async () => {
  vi.resetModules();
  document.body.replaceChildren();
  css = (await import('@/template/css')).css;
  registry = await import('@/template/vCSSStyleSheet');
});

/** A shadow root of a closed mode, which only the registry, through its element, reaches. */
const createHost = (): [Element, ShadowRoot] => {
  const element = document.createElement('div');
  document.body.append(element);
  return [element, element.attachShadow({ mode: 'closed' })];
};

describe('a host sheet', () => {
  it('is adopted ahead of the shared sheets in the closed root its element joined with', () => {
    const [element, host] = createHost();
    registry.addCSSHost(host);
    String(
      css`
        color: red;
      `
    );
    const shared = [...host.adoptedStyleSheets];
    const own = ownSheet(':host { --token: 1; }');

    expect(registry.adoptHostSheet(element, own)).toBeTypeOf('function');
    expect(host.adoptedStyleSheets).toEqual([own, ...shared]);
  });

  it('stays first as sheets register after it', () => {
    const [element, host] = createHost();
    registry.addCSSHost(host);
    const own = ownSheet(':host { --token: 1; }');
    registry.adoptHostSheet(element, own);

    String(
      css`
        color: red;
      `
    );
    String(
      css`
        color: blue;
      `
    );

    expect(host.adoptedStyleSheets[0]).toBe(own);
    expect(host.adoptedStyleSheets).toHaveLength(3);
  });

  it('is adopted by no element whose root never joined', () => {
    const [element, host] = createHost();

    expect(registry.adoptHostSheet(element, ownSheet(':host {}'))).toBeNull();
    expect(
      registry.adoptHostSheet(document.body, ownSheet(':host {}'))
    ).toBeNull();
    expect(host.adoptedStyleSheets).toEqual([]);
  });

  it('comes back with a host that leaves the page and joins again', () => {
    const [element, host] = createHost();
    const own = ownSheet(':host { --token: 1; }');
    registry.addCSSHost(host);
    registry.adoptHostSheet(element, own);

    registry.removeCSSHost(host);
    expect(host.adoptedStyleSheets).toEqual([]);

    registry.addCSSHost(host);
    expect(host.adoptedStyleSheets[0]).toBe(own);
  });

  it('belongs to its own host alone', () => {
    const [firstElement, first] = createHost();
    const [, second] = createHost();
    registry.addCSSHost(first);
    registry.addCSSHost(second);
    const own = ownSheet(':host { --token: 1; }');

    registry.adoptHostSheet(firstElement, own);

    expect(first.adoptedStyleSheets).toContain(own);
    expect(second.adoptedStyleSheets).not.toContain(own);
  });

  it('drops from its host alone, keeping the host sheets beside it in their order', () => {
    const [element, host] = createHost();
    registry.addCSSHost(host);
    String(
      css`
        color: red;
      `
    );
    const [shared] = host.adoptedStyleSheets;
    const first = ownSheet(':host { --first: 1; }');
    const second = ownSheet(':host { --second: 1; }');
    const dropFirst = registry.adoptHostSheet(element, first)!;
    const dropSecond = registry.adoptHostSheet(element, second)!;

    expect(host.adoptedStyleSheets).toEqual([first, second, shared]);

    dropFirst();
    expect(host.adoptedStyleSheets).toEqual([second, shared]);

    dropSecond();
    expect(host.adoptedStyleSheets).toEqual([shared]);

    // Dropped while away, it is not handed back as the host joins again.
    const dropAway = registry.adoptHostSheet(element, ownSheet(':host {}'))!;
    registry.removeCSSHost(host);
    dropAway();
    registry.addCSSHost(host);
    expect(host.adoptedStyleSheets).toEqual([shared]);
  });
});

describe('canAdoptStyleSheets', () => {
  it('holds where constructed stylesheets are adopted, and not where replace is missing', async () => {
    expect(registry.canAdoptStyleSheets()).toBe(true);

    let owner: object | null = CSSStyleSheet.prototype;
    while (owner && !Object.getOwnPropertyDescriptor(owner, 'replace')) {
      owner = Object.getPrototypeOf(owner);
    }
    const descriptor = Object.getOwnPropertyDescriptor(owner!, 'replace')!;
    delete (owner as Partial<CSSStyleSheet>).replace;
    try {
      vi.resetModules();
      const without = await import('@/template/vCSSStyleSheet');
      expect(without.canAdoptStyleSheets()).toBe(false);

      const element = document.createElement('div');
      document.body.append(element);
      without.addCSSHost(element.attachShadow({ mode: 'open' }));
      expect(without.adoptHostSheet(element, {} as CSSStyleSheet)).toBeNull();
    } finally {
      Object.defineProperty(owner!, 'replace', descriptor);
    }
  });
});
