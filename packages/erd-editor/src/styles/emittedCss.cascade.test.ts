/// <reference types="vite/client" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { addCSSHost, html, nextTick, render } from '@dineug/r-html';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The emitted-CSS gate.
 *
 * 62 of this package's modules define styles, and all but a dozen of their tests assert
 * `strings.join('')` — the *source* text of the tagged template. Source text passes no matter
 * what the compiler emits or where the emitted rules end up, so those tests cannot see a
 * compiler change, a scoping change, or a cascade change. This file closes that gap by loading
 * every style module into one shadow root and reading back what actually arrives there.
 *
 * What it asserts are properties, not a frozen copy of the output:
 *
 * 1. **The walk is complete.** A `css` template in a module the glob does not reach registers
 *    nothing here and leaves no trace saying so, which is how `utils/text.ts` went missing once.
 *    `declares a css template` reads the source tree instead of the emitted rules.
 * 2. **Order is cascade order.** A shadow root applies its own tree-order `styleSheets` before
 *    its `adoptedStyleSheets`, so a sheet that moves between those two pools changes which
 *    declaration wins without changing one character of rule text — invisible to any comparison
 *    of rule text, including a snapshot of it.
 *
 * There is deliberately no frozen fixture. One lived here through the compiler migration, when
 * "nothing moved" was the thing being checked and 300-odd rules of expected output were worth the
 * weight; every assertion that survived it holds without one.
 */

const styleModules: Record<string, () => Promise<unknown>> = {
  ...import.meta.glob('../**/*.styles.ts'),
  ...import.meta.glob('../**/*.style.ts'),
  /**
   * The one shipped module that declares a `css` template without being named `*.styles.ts`.
   *
   * The glob above missed it, and the miss was invisible from inside this file — it collected
   * 302 adopted rules while Chrome, reading the same editor through Playwright, reported 303.
   * `declares a css template` below is the guard that stops the next one being invisible too.
   */
  '../utils/text.ts': () => import('@/utils/text'),
};

/**
 * A glob key back to a repo-relative source path.
 *
 * Vite re-relativizes every glob key against the importing file, so the five modules that sit in
 * this file's own directory come back as `./reset.styles.ts`, not `../styles/reset.styles.ts` —
 * which is why this needs two cases rather than one prefix strip.
 */
const toSourcePath = (path: string) =>
  path.startsWith('./')
    ? path.replace(/^\.\//, 'src/styles/')
    : path.replace(/^\.\.\//, 'src/');

const modulePaths = Object.keys(styleModules).sort();

const SRC = join(process.cwd(), 'src');

/** Every `.ts` file under `src/`, as a repo-relative path. */
function sourceFiles(directory = SRC): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith('.ts')) return [];
    return [`src/${path.slice(SRC.length + 1)}`];
  });
}

type Rule = { module: string; selector: string; declarations: string };
type Emitted = {
  moduleCount: number;
  treeStyleRuleCount: number;
  adoptedRuleCount: number;
  ruleCount: number;
  rules: Rule[];
};

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** `.a { color: red; }` -> prelude / body. An at-rule keeps its nested rules in the body. */
function splitRule(cssText: string): Omit<Rule, 'module'> {
  const brace = cssText.indexOf('{');
  if (brace < 0) {
    return { selector: squash(cssText), declarations: '' };
  }
  let body = cssText.slice(brace + 1).trimEnd();
  if (body.endsWith('}')) {
    body = body.slice(0, -1);
  }
  return {
    selector: squash(cssText.slice(0, brace)),
    declarations: squash(body),
  };
}

const adoptedRuleTexts = (host: ShadowRoot) =>
  host.adoptedStyleSheets.flatMap(sheet =>
    Array.from(sheet.cssRules).map(rule => rule.cssText)
  );

/** A `<style>` element's rules, read back through CSSOM so both pools serialize alike. */
function styleElementRuleTexts(text: string): string[] {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(text);
  return Array.from(sheet.cssRules).map(rule => rule.cssText);
}

/**
 * `_` + 7 base36 chars of an FNV-1a hash of the template's canonical text — the generated class a
 * scoped template emits, and the one thing a `css.global` sheet never carries anywhere in it.
 */
const SCOPE_CLASS = /(?<![\w-])_[0-9a-z]{7}(?![\w-])/;

const flush = async (ticks = 3) => {
  for (let i = 0; i < ticks; i++) {
    await nextTick(() => {});
    await Promise.resolve();
  }
};

async function collect(): Promise<Emitted> {
  const hostElement = document.createElement('div');
  document.body.append(hostElement);
  const host = hostElement.attachShadow({ mode: 'open' });
  addCSSHost(host);

  // Nothing may have registered before the walk, or the first module absorbs it.
  expect(adoptedRuleTexts(host)).toEqual([]);

  // Every module's `css``` templates run at module-evaluation time and the shared sheet map has
  // no delete path, so a rule's first appearance names the module that registered it. This is
  // attribution only — it deliberately does not fix the order. P4 gave `css.global` sheets a
  // bucket that is adopted ahead of every component sheet however late they register, so the
  // registry no longer grows at the tail and discovery order is no longer cascade order.
  const owner = new Map<string, string>();

  for (const path of modulePaths) {
    await styleModules[path]();
    for (const cssText of adoptedRuleTexts(host)) {
      if (!owner.has(cssText)) owner.set(cssText, toSourcePath(path));
    }
  }

  // `GlobalStyles` into the same shadow root. It renders nothing now — the color picker was the
  // last `/* css */` factory and is a `css.global` sheet as of this phase — but it still pins the
  // global bucket's order, so it has to run before the adopted list is read back.
  const GlobalStyles = (await import('@/components/global-styles/GlobalStyles'))
    .default;
  render(host as any, html`<${GlobalStyles} />`);
  await flush();

  const finalAdopted = adoptedRuleTexts(host);

  // Every rule in the final cascade was attributed to a module, and no two of them share a text
  // that would collapse.
  expect(owner.size).toBe(finalAdopted.length);

  const adopted: Rule[] = finalAdopted.map(cssText => ({
    module: owner.get(cssText) as string,
    ...splitRule(cssText),
  }));

  /**
   * The `<style>`-element factories `GlobalStyles` renders, in render order.
   *
   * Empty as of the color-picker fold: `diff.ts` is the last `/* css *\/` raw string in the
   * package and it never goes through `GlobalStyles`. The machinery below stays because the
   * tree/adopted split is the half of the cascade that rule text cannot show, and the comparison
   * against an empty `factories` is the assertion that no `<style>` is being rendered — not an
   * absence of one.
   */
  const factories: Array<[string, () => HTMLStyleElement]> = [];

  const styleElements = Array.from(host.querySelectorAll('style'));
  expect(styleElements.map(element => element.textContent ?? '')).toEqual(
    factories.map(([, factory]) => factory().textContent ?? '')
  );

  const treeStyles: Rule[] = [];
  styleElements.forEach((element, index) => {
    for (const cssText of styleElementRuleTexts(element.textContent ?? '')) {
      treeStyles.push({ module: factories[index][0], ...splitRule(cssText) });
    }
  });

  const rules = [...treeStyles, ...adopted];

  return {
    moduleCount: modulePaths.length,
    treeStyleRuleCount: treeStyles.length,
    adoptedRuleCount: adopted.length,
    ruleCount: rules.length,
    rules,
  };
}

let actual: Emitted;

beforeAll(async () => {
  actual = await collect();
});

describe('emitted CSS', () => {
  it('reaches a shadow root from every style module', () => {
    expect(actual.moduleCount).toBe(62);
    expect(actual.ruleCount).toBe(
      actual.treeStyleRuleCount + actual.adoptedRuleCount
    );
    expect(actual.adoptedRuleCount).toBeGreaterThan(0);
  });

  it('collects every shipped module that declares a css template', () => {
    // The walk above is a glob over two filename shapes, so a `css` template in a file named
    // anything else is simply not collected — and nothing in the collected rules can say so,
    // because a rule that was never registered leaves no trace. This reads the source tree
    // instead: every shipped file holding a `css` tag has to be a module the walk imports.
    const covered = new Set(modulePaths.map(toSourcePath));

    const declaring = sourceFiles().filter(path => {
      // Stories are a Storybook-only surface and never reach a shipped bundle; tests and test
      // helpers register sheets of their own on purpose.
      if (/\.(test|stories)\.ts$/.test(path)) return false;
      if (path.startsWith('src/__test-utils__/')) return false;
      return /(?<![\w.])css(\.global)?`/.test(
        readFileSync(join(process.cwd(), path), 'utf8')
      );
    });

    expect(declaring.length).toBeGreaterThan(50);
    expect(declaring.filter(path => !covered.has(path))).toEqual([]);
  });

  it('puts every GlobalStyles `<style>` rule ahead of every adopted rule', () => {
    // Not decoration: this is the cascade. A shadow root's own `styleSheets` are applied
    // before its `adoptedStyleSheets`, so any sheet that moves between the two pools changes
    // which declaration wins at equal specificity. Rule text alone cannot show that.
    const tree = actual.rules.slice(0, actual.treeStyleRuleCount);
    const adopted = actual.rules.slice(actual.treeStyleRuleCount);

    // Zero since the color-picker fold — the strongest form of the property, not an absence of
    // it. The two assertions below are vacuous while it holds, and `collect()` is what keeps it
    // holding: it compares the shadow root's `<style>` elements against an empty `factories`, so
    // a `<style>` coming back fails there before anything here is read.
    expect(actual.treeStyleRuleCount).toBe(0);

    expect(tree.every(rule => rule.module.includes('#create'))).toBe(true);
    expect(adopted.some(rule => rule.module.includes('#create'))).toBe(false);
  });

  it('puts every global bucket rule ahead of every component rule', () => {
    // The half of the cascade the tree/adopted split used to carry for reset, fonts, typography
    // and scrollbar. They are adopted sheets now, so nothing about *where* they live orders them
    // any more — only `setGlobalStyleOrder`'s bucket does, and this is what watches it.
    // Read positionally rather than by module: a rule is attributed to whichever module first
    // pulled it in, and a component that imports `typography` gets there before `typography`
    // does. A `css.global` sheet is instead the only kind that carries no generated class.
    const adopted = actual.rules.slice(actual.treeStyleRuleCount);
    // 12 reset + 1 fonts + 1 typography + 6 scrollbar + 307 color picker.
    //
    // 20 -> 327: the color picker fold. It was a `/* css */` raw string rendered into a tree
    // `<style>`, which is why it was not in this count before and why it outranked the entire
    // adopted pool; it is a `css.global` literal now, so its 307 rules join the bucket. The four
    // positional checks below do not move with it, because `setGlobalStyleOrder` pins it *last* —
    // reset still starts the bucket and scrollbar still sits at 14.
    const BUCKET = 327;

    expect(adopted.findIndex(rule => SCOPE_CLASS.test(rule.selector))).toBe(
      BUCKET
    );
    expect(
      adopted.slice(0, BUCKET).every(rule => !SCOPE_CLASS.test(rule.selector))
    ).toBe(true);

    // …and inside the bucket, the order `setGlobalStyleOrder` pinned.
    expect(adopted[0].selector.startsWith('p,ol,ul')).toBe(true);
    expect(adopted[12].declarations).toContain('--text-font-family:');
    expect(adopted[13].declarations).toContain('--font-size-1:');
    expect(adopted[14].selector).toBe('::-webkit-scrollbar');
  });
});
