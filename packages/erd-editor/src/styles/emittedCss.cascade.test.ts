/// <reference types="vite/client" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { addCSSHost, html, nextTick, render } from '@dineug/r-html';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

const styleModules: Record<string, () => Promise<unknown>> = {
  ...import.meta.glob('../**/*.styles.ts'),
  ...import.meta.glob('../**/*.style.ts'),
  /**
   * The one shipped module declaring a css template without being named
   * *.styles.ts. The glob missed it, and the miss was invisible from inside this
   * file, which is what the declares a css template guard below now catches.
   */
  '../utils/text.ts': () => import('@/utils/text'),
};

/**
 * A glob key back to a repo-relative source path. Vite re-relativizes every key
 * against the importing file, so a module in this file's own directory comes
 * back with a different prefix, which is why this needs two cases.
 */
const toSourcePath = (path: string) =>
  path.startsWith('./')
    ? path.replace(/^\.\//, 'src/styles/')
    : path.replace(/^\.\.\//, 'src/');

const modulePaths = Object.keys(styleModules).sort();

const SRC = join(process.cwd(), 'src');

/** Every .ts file under src/, as a repo-relative path. */
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

/** .a { color: red; } -> prelude / body. An at-rule keeps its nested rules in the body. */
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

/** A <style> element's rules, read back through CSSOM so both pools serialize alike. */
function styleElementRuleTexts(text: string): string[] {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(text);
  return Array.from(sheet.cssRules).map(rule => rule.cssText);
}

/**
 * _ + 7 base36 chars of an FNV-1a hash of the template's canonical text — the generated class a
 * scoped template emits, and the one thing a css.global sheet never carries anywhere in it.
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

  // Every css template runs at module evaluation and the shared sheet map has no
  // delete path, so a rule's first appearance names the module that registered
  // it. Attribution only: the global bucket, not discovery order, fixes order.
  const owner = new Map<string, string>();

  for (const path of modulePaths) {
    await styleModules[path]();
    for (const cssText of adoptedRuleTexts(host)) {
      if (!owner.has(cssText)) owner.set(cssText, toSourcePath(path));
    }
  }

  // GlobalStyles into the same shadow root. It renders nothing now — the color picker was the
  // last /* css */ factory and is a css.global sheet as of this phase — but it still pins the
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
   * The <style>-element factories GlobalStyles renders, in render order. Empty,
   * and the machinery stays because comparing against an empty list is the
   * assertion that no <style> is rendered rather than an absence of one.
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
    expect(actual.moduleCount).toBe(56);
    expect(actual.ruleCount).toBe(
      actual.treeStyleRuleCount + actual.adoptedRuleCount
    );
    expect(actual.adoptedRuleCount).toBeGreaterThan(0);
  });

  it('collects every shipped module that declares a css template', () => {
    // The walk is a glob over two filename shapes, so a css template named
    // anything else is not collected and leaves no trace saying so. This reads
    // the source tree instead: every file holding a css tag must be walked.
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
    // Not decoration: this is the cascade. A shadow root's own styleSheets are applied
    // before its adoptedStyleSheets, so any sheet that moves between the two pools changes
    // which declaration wins at equal specificity. Rule text alone cannot show that.
    const tree = actual.rules.slice(0, actual.treeStyleRuleCount);
    const adopted = actual.rules.slice(actual.treeStyleRuleCount);

    // Zero is the strongest form of the property, not an absence of it. The two
    // assertions below are vacuous while it holds, and collect() keeps it
    // holding: a <style> coming back fails there before anything here is read.
    expect(actual.treeStyleRuleCount).toBe(0);

    expect(tree.every(rule => rule.module.includes('#create'))).toBe(true);
    expect(adopted.some(rule => rule.module.includes('#create'))).toBe(false);
  });

  it('puts every global bucket rule ahead of every component rule', () => {
    // Only setGlobalStyleOrder's bucket orders these now, and this is what
    // watches it. Read positionally rather than by module: a rule belongs to
    // whichever module first pulled it in, which need not be its own.
    const adopted = actual.rules.slice(actual.treeStyleRuleCount);
    // 12 reset + 1 fonts + 1 typography + 6 scrollbar + 307 color picker. The
    // four positional checks below do not move with the picker, because
    // setGlobalStyleOrder pins it last.
    const BUCKET = 327;

    expect(adopted.findIndex(rule => SCOPE_CLASS.test(rule.selector))).toBe(
      BUCKET
    );
    expect(
      adopted.slice(0, BUCKET).every(rule => !SCOPE_CLASS.test(rule.selector))
    ).toBe(true);

    // …and inside the bucket, the order setGlobalStyleOrder pinned.
    expect(adopted[0].selector.startsWith('p,ol,ul')).toBe(true);
    expect(adopted[12].declarations).toContain('--text-font-family:');
    expect(adopted[13].declarations).toContain('--font-size-1:');
    expect(adopted[14].selector).toBe('::-webkit-scrollbar');
  });
});
