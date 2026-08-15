import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CSSTemplateLiterals } from '@/template';
import type { CSS } from '@/template/css';

let css: CSS;
let addCSSHost: (host: ShadowRoot) => void;
let removeCSSHost: (host: ShadowRoot) => void;
let setGlobalStyleOrder: (order: ReadonlyArray<CSSTemplateLiterals>) => void;

const createHost = (): ShadowRoot => {
  const host = document.createElement('div');
  document.body.append(host);
  return host.attachShadow({ mode: 'open' });
};

const rulesOf = (host: ShadowRoot): string[] =>
  host.adoptedStyleSheets.flatMap(sheet =>
    Array.from(sheet.cssRules).map(rule => rule.cssText)
  );

const styleTextsOf = (host: ShadowRoot): string[] =>
  Array.from(host.querySelectorAll('style')).map(el => el.textContent ?? '');

/** `css` and the sheet registry, in a module registry of their own so no state leaks between tests. */
const load = async () => {
  vi.resetModules();
  css = (await import('@/template/css')).css;
  const vCSSStyleSheet = await import('@/template/vCSSStyleSheet');
  addCSSHost = vCSSStyleSheet.addCSSHost;
  removeCSSHost = vCSSStyleSheet.removeCSSHost;
  setGlobalStyleOrder = vCSSStyleSheet.setGlobalStyleOrder;
};

/**
 * The prototype that actually owns a `CSSStyleSheet` method.
 *
 * happy-dom hands each window its own `class CSSStyleSheet extends <impl>`, so
 * `CSSStyleSheet.prototype` owns nothing but `constructor` and the methods are inherited one link
 * up. `delete CSSStyleSheet.prototype.replace` therefore returns `true` and removes nothing — a
 * stub that looks like it worked and leaves the fallback unreachable. `vi.spyOn` has the same
 * problem in reverse: it would install an own property on the subclass and shadow the real one
 * without ever seeing the calls the library makes. This walks to the owner instead.
 */
const ownerOf = (method: keyof CSSStyleSheet): object => {
  let proto: object | null = CSSStyleSheet.prototype;
  while (proto && !Object.getOwnPropertyDescriptor(proto, method)) {
    proto = Object.getPrototypeOf(proto);
  }
  if (!proto) throw new Error(`no prototype in the chain owns \`${method}\``);
  return proto;
};

const REPLACE_OWNER = ownerOf('replace');

const REPLACE_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  REPLACE_OWNER,
  'replace'
) as PropertyDescriptor;

/**
 * The same load, with constructable stylesheets taken away.
 *
 * `supportsAdoptingStyleSheets` is a module-level const evaluated once at import time, so the only
 * way into the `<style>` fallback is to make the capability absent *before* the import. This
 * removes `replace` — the third term of that detection, and the one that can go without breaking
 * the CSSOM the rest of the file reads back through `adoptedStyleSheets` — for exactly the length
 * of the import, then puts it straight back. The const is resolved by then, so the loaded module
 * keeps the fallback while every other test sees an intact `CSSStyleSheet`.
 *
 * The capability is never assumed to be gone: `adopts nothing` below reads `adoptedStyleSheets`
 * and fails loudly if a future happy-dom moves `replace` again, rather than quietly re-testing the
 * adopted path under a fallback heading.
 */
const loadWithoutConstructableStyleSheets = async () => {
  delete (REPLACE_OWNER as Partial<CSSStyleSheet>).replace;
  try {
    await load();
  } finally {
    Object.defineProperty(REPLACE_OWNER, 'replace', REPLACE_DESCRIPTOR);
  }
};

const ADOPTED_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ShadowRoot.prototype,
  'adoptedStyleSheets'
) as PropertyDescriptor;

/**
 * Turns `adoptedStyleSheets` into the shape Chrome 73-98 exposed.
 *
 * happy-dom's is a plain mutable array — the ObservableArray of Chrome 99, Firefox 101 and Safari
 * 16.4, the *newer* of the two shapes the attribute has had. The older one is a WebIDL
 * `FrozenArray`: the setter still works, but every read hands back a frozen array, so the list can
 * only ever be replaced. Wrapping the getter reproduces that exactly, which does two things — it
 * reaches the reassignment fallback, and it makes a `push` the code should not have attempted
 * throw rather than quietly succeed.
 */
const freezeAdoptedStyleSheets = () => {
  const get = ADOPTED_DESCRIPTOR.get as (this: ShadowRoot) => CSSStyleSheet[];

  Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
    ...ADOPTED_DESCRIPTOR,
    get(this: ShadowRoot) {
      return Object.freeze([...get.call(this)]);
    },
  });
};

const restoreAdoptedStyleSheets = () => {
  Object.defineProperty(
    ShadowRoot.prototype,
    'adoptedStyleSheets',
    ADOPTED_DESCRIPTOR
  );
};

/** Deterministic PRNG — a sequence nobody can replay is a sequence nobody can debug. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

beforeEach(load);

describe('template/vCSSStyleSheet', () => {
  describe('constructable stylesheet mode', () => {
    it('adopts the stylesheets registered before the host joins', () => {
      const tpl = css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);

      expect(host.adoptedStyleSheets).toHaveLength(1);
      expect(rulesOf(host)).toEqual([`.${String(tpl)} { color: red; }`]);
    });

    it('pushes newly rendered stylesheets to already registered hosts', () => {
      const host = createHost();
      addCSSHost(host);
      expect(host.adoptedStyleSheets).toHaveLength(0);

      const tpl = css`
        color: blue;
      `;

      expect(rulesOf(host)).toEqual([`.${String(tpl)} { color: blue; }`]);
    });

    it('shares one stylesheet between every registered host', () => {
      const first = createHost();
      const second = createHost();
      addCSSHost(first);
      addCSSHost(second);

      css`
        color: red;
      `;

      expect(first.adoptedStyleSheets).toHaveLength(1);
      expect(first.adoptedStyleSheets[0]).toBe(second.adoptedStyleSheets[0]);
    });

    it('registers a selector only once', () => {
      const host = createHost();
      addCSSHost(host);

      const a = css`
        color: red;
      `;
      const b = css`
        color: red;
      `;

      expect(String(a)).toBe(String(b));
      expect(host.adoptedStyleSheets).toHaveLength(1);
    });

    it('creates one stylesheet per template, however many rules it has', () => {
      const host = createHost();
      addCSSHost(host);

      const tpl = css`
        color: red;
        .foo {
          color: blue;
        }
      `;

      expect(host.adoptedStyleSheets).toHaveLength(1);
      expect(rulesOf(host)).toEqual([
        `.${String(tpl)} { color: red; }`,
        `.${String(tpl)} .foo { color: blue; }`,
      ]);
    });
  });

  describe('global bucket', () => {
    it('adopts a global sheet ahead of a component sheet registered before it', () => {
      const host = createHost();
      addCSSHost(host);

      const component = css`
        color: red;
      `;
      css.global`
        .g {
          color: blue;
        }
      `;

      expect(rulesOf(host)).toEqual([
        '.g { color: blue; }',
        `.${String(component)} { color: red; }`,
      ]);
    });

    it('keeps every global ahead of every component, whatever the interleaving', () => {
      const host = createHost();
      addCSSHost(host);

      css`
        color: red;
      `;
      css.global`
        .g1 {
          color: blue;
        }
      `;
      css`
        color: green;
      `;
      css.global`
        .g2 {
          color: purple;
        }
      `;

      expect(rulesOf(host).slice(0, 2)).toEqual([
        '.g1 { color: blue; }',
        '.g2 { color: purple; }',
      ]);
    });

    it('follows the pinned array and not the registration order', () => {
      const host = createHost();
      addCSSHost(host);

      // Registered alphabetically, the way `simple-import-sort` would order the imports.
      const fonts = css.global`
        .fonts {
          color: blue;
        }
      `;
      const reset = css.global`
        .reset {
          color: red;
        }
      `;
      const scrollbar = css.global`
        .scrollbar {
          color: green;
        }
      `;

      expect(rulesOf(host)).toEqual([
        '.fonts { color: blue; }',
        '.reset { color: red; }',
        '.scrollbar { color: green; }',
      ]);

      setGlobalStyleOrder([reset, fonts, scrollbar]);

      expect(rulesOf(host)).toEqual([
        '.reset { color: red; }',
        '.fonts { color: blue; }',
        '.scrollbar { color: green; }',
      ]);
    });

    it('applies the pinned order to a global registered after the pin', () => {
      const host = createHost();
      addCSSHost(host);

      const first = css.global`
        .first {
          color: red;
        }
      `;
      setGlobalStyleOrder([first]);

      css.global`
        .later {
          color: blue;
        }
      `;

      expect(rulesOf(host)).toEqual([
        '.first { color: red; }',
        '.later { color: blue; }',
      ]);
    });

    it('trails an unpinned global behind every pinned one, in registration order', () => {
      const host = createHost();
      addCSSHost(host);

      const pinned = css.global`
        .pinned {
          color: red;
        }
      `;
      css.global`
        .unpinned1 {
          color: blue;
        }
      `;
      css.global`
        .unpinned2 {
          color: green;
        }
      `;
      setGlobalStyleOrder([pinned]);

      expect(rulesOf(host)).toEqual([
        '.pinned { color: red; }',
        '.unpinned1 { color: blue; }',
        '.unpinned2 { color: green; }',
      ]);
    });

    it('ignores a scoped literal in the pinned array', () => {
      const host = createHost();
      addCSSHost(host);

      const component = css`
        color: red;
      `;
      const global = css.global`
        .g {
          color: blue;
        }
      `;

      setGlobalStyleOrder([component, global]);

      expect(rulesOf(host)).toEqual([
        '.g { color: blue; }',
        `.${String(component)} { color: red; }`,
      ]);
    });

    it('pushes the pinned order to hosts that join later', () => {
      const fonts = css.global`
        .fonts {
          color: blue;
        }
      `;
      const reset = css.global`
        .reset {
          color: red;
        }
      `;
      setGlobalStyleOrder([reset, fonts]);

      const host = createHost();
      addCSSHost(host);

      expect(rulesOf(host)).toEqual([
        '.reset { color: red; }',
        '.fonts { color: blue; }',
      ]);
    });
  });

  /**
   * Reordering the array is only half of what a pin has to do.
   *
   * Chromium works out what to invalidate after an `adoptedStyleSheets` change from the symmetric
   * difference of the rule sets, so a permutation — same sheets, new order — dirties nothing and
   * every element that already has a computed style keeps the winner it first resolved with.
   * `setGlobalStyleOrder` re-runs `replaceSync` over each global's own text to force that
   * invalidation. `e2e/specs/chromium-ignores-adopted-sheet-reorder.spec.ts` is what proves the
   * sequence moves a real cascade; happy-dom has no style engine and can only hold the call
   * pattern in place, which is exactly what these do.
   */
  describe('pinned order invalidation', () => {
    const spyReplaceSync = () =>
      vi.spyOn(
        ownerOf('replaceSync') as Pick<CSSStyleSheet, 'replaceSync'>,
        'replaceSync'
      );

    afterEach(() => vi.restoreAllMocks());

    it('re-runs replaceSync over every global once a host is holding a list', () => {
      const host = createHost();
      addCSSHost(host);

      const reset = css.global`
        .reset {
          color: red;
        }
      `;
      const fonts = css.global`
        .fonts {
          color: blue;
        }
      `;

      // Installed after registration, so the `replaceSync` each sheet gets on creation is not
      // counted and the only calls left are the ones the pin makes.
      const replaceSync = spyReplaceSync();
      setGlobalStyleOrder([fonts, reset]);

      // The compiler's own bytes, not the CSSOM's re-serialization: this is the text the
      // registry is holding, which is exactly what has to go back in.
      expect(replaceSync.mock.calls.map(([cssText]) => cssText)).toEqual([
        '.reset{color:red;}',
        '.fonts{color:blue;}',
      ]);
    });

    it('leaves component sheets alone', () => {
      const host = createHost();
      addCSSHost(host);

      const global = css.global`
        .g {
          color: red;
        }
      `;
      const component = css`
        color: blue;
      `;

      const replaceSync = spyReplaceSync();
      setGlobalStyleOrder([global]);

      // A component sheet can never move: the bucket puts every global ahead of every component
      // and components keep registration order, so re-parsing one would be pure cost.
      expect(replaceSync.mock.calls.map(([cssText]) => cssText)).toEqual([
        '.g{color:red;}',
      ]);
      expect(replaceSync.mock.calls.map(([cssText]) => cssText)).not.toContain(
        `.${String(component)}{color:blue;}`
      );
    });

    it('does nothing at all when no host has joined', () => {
      css.global`
        .reset {
          color: red;
        }
      `;
      const fonts = css.global`
        .fonts {
          color: blue;
        }
      `;

      // The startup case, and the one worth keeping free: with nothing mounted there is no stale
      // resolution anywhere, and every host that joins later reads the pinned array as it is.
      const replaceSync = spyReplaceSync();
      setGlobalStyleOrder([fonts]);

      expect(replaceSync).not.toHaveBeenCalled();
    });

    it('leaves every rule intact', () => {
      const host = createHost();
      addCSSHost(host);

      const reset = css.global`
        .reset {
          color: red;
        }
      `;
      const fonts = css.global`
        .fonts {
          color: blue;
        }
      `;

      setGlobalStyleOrder([fonts, reset]);

      // Re-parsing is a means to an invalidation, never a rewrite: the same rules have to come
      // back out, in the pinned order.
      expect(rulesOf(host)).toEqual([
        '.fonts { color: blue; }',
        '.reset { color: red; }',
      ]);
    });
  });

  describe('addCSSHost', () => {
    it('is a no-op for an already registered host', () => {
      css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);
      expect(host.adoptedStyleSheets).toHaveLength(1);

      host.adoptedStyleSheets = [];
      addCSSHost(host);

      expect(host.adoptedStyleSheets).toHaveLength(0);
    });

    it('registers a host even when no stylesheet exists yet', () => {
      const host = createHost();

      expect(() => addCSSHost(host)).not.toThrow();
      expect(host.adoptedStyleSheets).toHaveLength(0);
    });
  });

  describe('removeCSSHost', () => {
    it('clears the adopted stylesheets of the host', () => {
      css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);
      expect(host.adoptedStyleSheets).toHaveLength(1);

      removeCSSHost(host);

      expect(host.adoptedStyleSheets).toHaveLength(0);
    });

    it('stops the host from receiving later stylesheets', () => {
      const host = createHost();
      addCSSHost(host);
      removeCSSHost(host);

      css`
        color: red;
      `;

      expect(host.adoptedStyleSheets).toHaveLength(0);
    });

    it('leaves other hosts untouched', () => {
      const removed = createHost();
      const kept = createHost();
      addCSSHost(removed);
      addCSSHost(kept);
      css`
        color: red;
      `;

      removeCSSHost(removed);

      expect(removed.adoptedStyleSheets).toHaveLength(0);
      expect(kept.adoptedStyleSheets).toHaveLength(1);
    });

    it('is a no-op for an unknown host', () => {
      const host = createHost();
      const unknown = createHost();
      addCSSHost(host);
      css`
        color: red;
      `;
      unknown.adoptedStyleSheets = host.adoptedStyleSheets;

      expect(() => removeCSSHost(unknown)).not.toThrow();
      expect(unknown.adoptedStyleSheets).toHaveLength(1);
    });

    it('is a no-op when called twice', () => {
      const host = createHost();
      addCSSHost(host);
      css`
        color: red;
      `;
      removeCSSHost(host);
      host.adoptedStyleSheets = [new CSSStyleSheet()];

      removeCSSHost(host);

      expect(host.adoptedStyleSheets).toHaveLength(1);
    });
  });

  /**
   * The path a browser without constructable stylesheets takes. Safari shipped
   * `adoptedStyleSheets` in 16.4 and this package targets ES2020, so it is a shipping path and not
   * dead code — but happy-dom supports the constructable API, which means nothing reaches it
   * unless the capability is taken away at import time. See
   * `loadWithoutConstructableStyleSheets`.
   */
  describe('<style> element fallback', () => {
    beforeEach(loadWithoutConstructableStyleSheets);

    it('adopts nothing and appends a style element instead', () => {
      const tpl = css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);

      // The guard on the harness itself: if the capability deletion ever stops taking, this is
      // the assertion that says so instead of every test below silently re-testing the adopted path.
      expect(host.adoptedStyleSheets).toEqual([]);
      expect(styleTextsOf(host)).toEqual([`.${String(tpl)}{color:red;}`]);
    });

    it('pushes a newly rendered stylesheet to an already registered host', () => {
      const host = createHost();
      addCSSHost(host);
      expect(styleTextsOf(host)).toEqual([]);

      const tpl = css`
        color: blue;
      `;

      expect(styleTextsOf(host)).toEqual([`.${String(tpl)}{color:blue;}`]);
    });

    it('appends only the style elements the host does not have yet', () => {
      css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);
      expect(styleTextsOf(host)).toHaveLength(1);

      const next = css`
        .bar {
          color: green;
        }
      `;

      const texts = styleTextsOf(host);
      expect(texts).toHaveLength(2);
      expect(texts[1]).toBe(`.${String(next)} .bar{color:green;}`);
    });

    it('gives every host its own imported copy of a style element', () => {
      css`
        color: red;
      `;
      const first = createHost();
      addCSSHost(first);

      const second = createHost();
      addCSSHost(second);

      expect(styleTextsOf(second)).toEqual(styleTextsOf(first));
      expect(second.querySelector('style')).not.toBe(
        first.querySelector('style')
      );
    });

    it('removes the appended style elements on removeCSSHost', () => {
      css`
        color: red;
        .foo {
          color: blue;
        }
      `;
      const host = createHost();
      addCSSHost(host);
      expect(styleTextsOf(host)).toHaveLength(1);

      removeCSSHost(host);

      expect(styleTextsOf(host)).toHaveLength(0);
    });

    it('inserts a later global ahead of the component elements already mounted', () => {
      const component = css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);

      css.global`
        .g {
          color: blue;
        }
      `;

      // The `insertBefore` half of the fallback: the component element is already in the tree and
      // is not moved, so the only way the global lands ahead of it is the insertion point.
      expect(styleTextsOf(host)).toEqual([
        '.g{color:blue;}',
        `.${String(component)}{color:red;}`,
      ]);
    });

    it('honours the pinned order for a host that joins after the pin', () => {
      const fonts = css.global`
        .fonts {
          color: blue;
        }
      `;
      const reset = css.global`
        .reset {
          color: red;
        }
      `;
      css`
        color: green;
      `;
      setGlobalStyleOrder([reset, fonts]);

      const host = createHost();
      addCSSHost(host);

      expect(styleTextsOf(host).slice(0, 2)).toEqual([
        '.reset{color:red;}',
        '.fonts{color:blue;}',
      ]);
    });

    it('stops appending style elements to a removed host', () => {
      css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);
      removeCSSHost(host);

      css`
        color: purple;
      `;

      expect(styleTextsOf(host)).toHaveLength(0);
    });
  });

  /**
   * Which path a registration took is observable without a spy, because the two do different
   * things to the array object the host is holding: an append mutates the one that is already
   * there, a rebuild hands over a new one. So array identity *is* the signal, and it is a better
   * one than a counter — it reads the effect the optimisation exists to produce instead of the
   * call that was supposed to produce it.
   *
   * It holds whichever way the setter behaves. A rebuild assigns, and an assignment always
   * installs a new backing list; an append never assigns, so nothing can replace it.
   */
  describe('append fast path', () => {
    it('appends a component sheet without rebuilding the adopted list', () => {
      const host = createHost();
      addCSSHost(host);
      const adopted = host.adoptedStyleSheets;

      for (let i = 0; i < 50; i++) {
        css`
          z-index: ${i};
        `;
      }

      // 50 registrations, not one rebuild: a component sheet sorts to the end of the bucket, so
      // its position is known and the ordering pass is never run.
      expect(host.adoptedStyleSheets).toBe(adopted);
      expect(adopted).toHaveLength(50);
    });

    it('rebuilds the adopted list when a global sheet is registered', () => {
      const host = createHost();
      addCSSHost(host);
      const component = css`
        color: red;
      `;
      const adopted = host.adoptedStyleSheets;

      css.global`
        .g {
          color: blue;
        }
      `;

      // A global lands inside the pinned bucket, ahead of the component already adopted, so there
      // is no appending it — and the list the host holds has to be replaced.
      expect(host.adoptedStyleSheets).not.toBe(adopted);
      expect(rulesOf(host)).toEqual([
        '.g { color: blue; }',
        `.${String(component)} { color: red; }`,
      ]);
    });

    it('appends to every registered host', () => {
      const first = createHost();
      const second = createHost();
      addCSSHost(first);
      addCSSHost(second);
      const adoptedByFirst = first.adoptedStyleSheets;
      const adoptedBySecond = second.adoptedStyleSheets;

      const tpl = css`
        color: red;
      `;

      expect(first.adoptedStyleSheets).toBe(adoptedByFirst);
      expect(second.adoptedStyleSheets).toBe(adoptedBySecond);
      expect(first.adoptedStyleSheets[0]).toBe(second.adoptedStyleSheets[0]);
      expect(rulesOf(second)).toEqual([`.${String(tpl)} { color: red; }`]);
    });

    it('does not touch the hosts that already joined when another one joins', () => {
      const first = createHost();
      addCSSHost(first);
      css`
        color: red;
      `;
      const adopted = first.adoptedStyleSheets;

      const second = createHost();
      addCSSHost(second);

      // A joining host is the only one behind — every host already registered is holding exactly
      // the list the new one is about to be handed, so reassigning it to all of them is a write
      // nothing asked for.
      expect(first.adoptedStyleSheets).toBe(adopted);
      expect(rulesOf(second)).toEqual(rulesOf(first));
    });

    it('keeps appending after a pinned order is set', () => {
      const host = createHost();
      addCSSHost(host);
      const global = css.global`
        .g {
          color: blue;
        }
      `;
      setGlobalStyleOrder([global]);
      const adopted = host.adoptedStyleSheets;

      const component = css`
        color: red;
      `;

      // `setGlobalStyleOrder` invalidates the cache, and the rebuild it triggers has to leave it
      // populated — otherwise the next component registration falls back to a rebuild forever.
      expect(host.adoptedStyleSheets).toBe(adopted);
      expect(rulesOf(host)).toEqual([
        '.g { color: blue; }',
        `.${String(component)} { color: red; }`,
      ]);
    });
  });

  /**
   * The trap in `adoptedStyleSheets`: a browser can support the attribute and still refuse to let
   * it be mutated. Chrome 73-98 is that browser. `supportsAdoptingStyleSheets` cannot see the
   * difference — both shapes answer its three questions the same way — so mutability is detected
   * on its own, and when it is absent every update is a reassignment, permanently.
   *
   * The getter stays wrapped for the whole block on purpose: if anything below reached for `push`,
   * it would throw here rather than pass.
   */
  describe('frozen adoptedStyleSheets', () => {
    beforeEach(async () => {
      freezeAdoptedStyleSheets();
      await load();
    });

    afterEach(restoreAdoptedStyleSheets);

    it('adopts in cascade order through reassignment alone', () => {
      const host = createHost();
      addCSSHost(host);

      const component = css`
        color: red;
      `;
      css.global`
        .g {
          color: blue;
        }
      `;
      const later = css`
        color: green;
      `;

      // The guard on the harness itself: if the wrap ever stops taking, this says so instead of
      // the block silently re-testing the mutable path under a frozen heading.
      expect(Object.isFrozen(host.adoptedStyleSheets)).toBe(true);
      expect(rulesOf(host)).toEqual([
        '.g { color: blue; }',
        `.${String(component)} { color: red; }`,
        `.${String(later)} { color: green; }`,
      ]);
    });

    it('never attempts a push, however many sheets are registered', () => {
      const host = createHost();
      addCSSHost(host);

      expect(() => {
        for (let i = 0; i < 20; i++) {
          css`
            z-index: ${i};
          `;
        }
      }).not.toThrow();

      expect(host.adoptedStyleSheets).toHaveLength(20);
    });

    it('hands a host that joins later the same list', () => {
      const first = createHost();
      addCSSHost(first);
      css`
        color: red;
      `;
      css.global`
        .g {
          color: blue;
        }
      `;

      const second = createHost();
      addCSSHost(second);

      expect(rulesOf(second)).toEqual(rulesOf(first));
      expect(second.adoptedStyleSheets).toHaveLength(2);
    });

    it('honours a pinned order set after the sheets were registered', () => {
      const host = createHost();
      addCSSHost(host);

      const fonts = css.global`
        .fonts {
          color: blue;
        }
      `;
      const reset = css.global`
        .reset {
          color: red;
        }
      `;
      setGlobalStyleOrder([reset, fonts]);

      expect(rulesOf(host)).toEqual([
        '.reset { color: red; }',
        '.fonts { color: blue; }',
      ]);
    });
  });

  /**
   * The fast path is only sound if nothing can tell it from the slow one, and the interesting
   * failures are the ones no hand-written case thinks to interleave — a pin between two component
   * registrations, a host joining while the bucket is stale, a global arriving after a host left.
   *
   * So the sequence is generated and the expectation is derived independently: the oracle below
   * re-states the rule (`orderedVSheets`) from the operations the test itself issued, rather than
   * calling into the module and comparing it with itself. The seed is fixed, so a failure replays.
   */
  describe('equivalence with a full rebuild', () => {
    const componentTemplates = [
      () => css`
        color: red;
      `,
      () => css`
        color: blue;
      `,
      () => css`
        color: green;
      `,
      () => css`
        color: purple;
      `,
      () => css`
        color: orange;
      `,
      () => css`
        color: teal;
      `,
    ];

    const globalTemplates = [
      () => css.global`
        .g0 {
          color: red;
        }
      `,
      () => css.global`
        .g1 {
          color: blue;
        }
      `,
      () => css.global`
        .g2 {
          color: green;
        }
      `,
      () => css.global`
        .g3 {
          color: purple;
        }
      `,
    ];

    it.each([0x5eed, 0x1234, 0xabcdef, 0x0f0f0f])(
      'matches a full rebuild over a seeded sequence (seed %#)',
      seed => {
        const random = mulberry32(seed);
        const pick = <T>(items: T[]): T =>
          items[Math.floor(random() * items.length)];

        const registered: Array<{ id: string; mode: 'global' | 'scoped' }> = [];
        const literalOf = new Map<string, CSSTemplateLiterals>();
        const idOf = new Map<CSSStyleSheet, string>();
        let pinned: string[] = [];

        // Registered before anything else and never removed, so every sheet ever created passes
        // through it — which is what lets a sheet be tied back to the identifier that made it.
        const observer = createHost();
        addCSSHost(observer);
        const hosts = [observer];
        const removed: ShadowRoot[] = [];
        const performed = { pinned: 0, joined: 0, left: 0, rejoined: 0 };

        const register = (
          literal: CSSTemplateLiterals,
          mode: 'global' | 'scoped'
        ) => {
          const id = String(literal);
          if (literalOf.has(id)) return; // same content, so `vRender` registered nothing

          const added = Array.from(observer.adoptedStyleSheets).find(
            sheet => !idOf.has(sheet)
          );
          if (!added) throw new Error(`no sheet was adopted for ${mode} ${id}`);

          registered.push({ id, mode });
          literalOf.set(id, literal);
          idOf.set(added, id);
        };

        /** `orderedVSheets`, restated: pinned globals, then unpinned ones, then components. */
        const expected = () => {
          const rank = (id: string) => {
            const index = pinned.indexOf(id);
            return index === -1 ? pinned.length : index;
          };
          const globals = registered
            .map((entry, index) => ({ ...entry, index }))
            .filter(({ mode }) => mode === 'global')
            // The tiebreak is explicit rather than leaning on `sort` being stable, so the oracle
            // and the implementation agree for reasons of their own.
            .sort((a, b) => rank(a.id) - rank(b.id) || a.index - b.index)
            .map(({ id }) => id);
          const components = registered
            .filter(({ mode }) => mode === 'scoped')
            .map(({ id }) => id);

          return [...globals, ...components];
        };

        const adoptedIds = (host: ShadowRoot) =>
          Array.from(host.adoptedStyleSheets).map(
            sheet => idOf.get(sheet) ?? '<unregistered sheet>'
          );

        const check = () => {
          const ids = expected();
          hosts.forEach(host => expect(adoptedIds(host)).toEqual(ids));
          removed.forEach(host =>
            expect(host.adoptedStyleSheets).toHaveLength(0)
          );
        };

        const operations = [
          () => register(pick(componentTemplates)(), 'scoped'),
          () => register(pick(globalTemplates)(), 'global'),
          () => {
            const pool = [...literalOf.values()];
            for (let i = pool.length - 1; i > 0; i--) {
              const j = Math.floor(random() * (i + 1));
              [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            // A prefix, so the pin covers "some pinned, some not" — and it is drawn from every
            // literal, so a component sometimes lands in the array the way `setGlobalStyleOrder`
            // says it may.
            const order = pool.slice(
              0,
              Math.floor(random() * (pool.length + 1))
            );

            pinned = order.map(String);
            setGlobalStyleOrder(order);
            if (order.length > 0) performed.pinned++;
          },
          () => {
            const host = createHost();
            addCSSHost(host);
            hosts.push(host);
            performed.joined++;
          },
          () => {
            if (hosts.length < 2) return; // never the observer
            const [host] = hosts.splice(
              1 + Math.floor(random() * (hosts.length - 1)),
              1
            );

            removeCSSHost(host);
            removed.push(host);
            performed.left++;
          },
          () => {
            // Moving a custom element in the DOM runs `disconnectedCallback` and then
            // `connectedCallback`, so a host that left and came back is a shipping path and not a
            // contrivance.
            if (removed.length === 0) return;
            const [host] = removed.splice(
              Math.floor(random() * removed.length),
              1
            );

            addCSSHost(host);
            hosts.push(host);
            performed.rejoined++;
          },
        ];

        check();
        for (let i = 0; i < 200; i++) {
          pick(operations)();
          check();
        }

        // A seed that never got round to an operation would pass the loop above without proving
        // anything about it, so what the sequence *did* is asserted rather than where it ended up
        // — a run can legitimately end with every host removed and an empty pin.
        expect(registered.filter(({ mode }) => mode === 'scoped')).toHaveLength(
          componentTemplates.length
        );
        expect(registered.filter(({ mode }) => mode === 'global')).toHaveLength(
          globalTemplates.length
        );
        expect(performed.pinned).toBeGreaterThan(0);
        expect(performed.joined).toBeGreaterThan(0);
        expect(performed.left).toBeGreaterThan(0);
        expect(performed.rejoined).toBeGreaterThan(0);
      }
    );
  });
});
