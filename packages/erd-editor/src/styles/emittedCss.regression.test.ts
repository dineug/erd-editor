/// <reference types="vite/client" />
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';

/**
 * The two regression assertions the CSS compiler switch owes.
 *
 * 1. Selector-list scope widening. The old hand-written pipeline treated a comma list as one
 *    string and prefixed the scope once, so segments 2..n leaked globally. `stylis`' `ruleset()`
 *    distributes the scope over the cartesian product instead, so every segment is scoped.
 * 2. Rule-count invariance. Loading all 62 style modules must not lose a rule, whether they are
 *    loaded in isolation (one module per module registry) or cumulatively (all in one).
 *
 * The 62 here is the `*.styles.ts` / `*.style.ts` glob, which is the surface the compiler switch
 * was measured over. It is not the whole style surface: `utils/text.ts` declares a `css` template
 * too. `emittedCss.cascade.test.ts` is the file that covers all 63 and guards the count.
 *
 * Both are measured against the emitted CSSOM — `adoptedStyleSheets` on a real shadow root — and
 * not against the source text, because the source text is what the other 49 `*.styles.test.ts`
 * files already assert and it cannot see a wiring change.
 */

const styleModules = {
  ...import.meta.glob('../**/*.styles.ts'),
  ...import.meta.glob('../**/*.style.ts'),
};

const modulePaths = Object.keys(styleModules).sort();

const SCOPE_CLASS = /\._[0-9a-z]{7}/;

function adoptedSheets(addCSSHost: (host: ShadowRoot) => void): string[][] {
  const host = document.createElement('div').attachShadow({ mode: 'open' });
  addCSSHost(host);

  return host.adoptedStyleSheets.map(sheet =>
    Array.from(sheet.cssRules).map(rule => rule.cssText)
  );
}

function adoptedRules(addCSSHost: (host: ShadowRoot) => void): string[] {
  return adoptedSheets(addCSSHost).flat();
}

/**
 * A `css.global` sheet is the one kind that carries no generated class anywhere in it. Marker
 * text will not do: four component sheets also declare `box-sizing: border-box` `[measured]`.
 * The rule-count assertion below is what would catch a scoped template that emitted nothing but
 * `@keyframes` — there is none today.
 */
function isGlobalSheet(rules: string[]): boolean {
  return !rules.some(text => SCOPE_CLASS.test(text));
}

function selectorOf(cssText: string): string {
  return cssText.slice(0, cssText.indexOf('{')).trim();
}

/** Every rule adopted when all 62 modules share one module registry. */
let cumulative: string[] = [];
/** The `css.global` half of `cumulative`, which the bucket keeps in front. */
let globalRules: string[] = [];
/** The scoped half. */
let componentRules: string[] = [];
let sheetsOfEachKind = { global: 0, component: 0 };
/** Every rule adopted when each module is rendered alone in a fresh registry. */
let isolated = new Map<string, string[]>();

let canvasSvgScope = '';
let erdEditorScope = '';
let codeBlockRootScope = '';
let codeBlockClipboardScope = '';
let colorPickerScope = '';
let sashScope = '';

beforeAll(async () => {
  vi.resetModules();
  const { addCSSHost } = await import('@dineug/r-html');
  for (const path of modulePaths) {
    await styleModules[path]();
  }

  const canvasSvg =
    await import('@/components/erd/canvas/canvas-svg/CanvasSvg.styles');
  const erdEditor = await import('@/components/erd-editor/ErdEditor.styles');
  const codeBlock =
    await import('@/components/primitives/code-block/CodeBlock.styles');
  const colorPicker =
    await import('@/components/primitives/color-picker/ColorPicker.styles');
  const sash = await import('@/components/primitives/sash/Sash.styles');
  canvasSvgScope = `.${String(canvasSvg.root)}`;
  erdEditorScope = `.${String(erdEditor.root)}`;
  codeBlockRootScope = `.${String(codeBlock.root)}`;
  codeBlockClipboardScope = `.${String(codeBlock.clipboard)}`;
  colorPickerScope = `.${String(colorPicker.container)}`;
  sashScope = `.${String(sash.sash)}`;

  const sheets = adoptedSheets(addCSSHost);
  globalRules = sheets.filter(isGlobalSheet).flat();
  componentRules = sheets.filter(rules => !isGlobalSheet(rules)).flat();
  cumulative = sheets.flat();
  sheetsOfEachKind = {
    global: sheets.filter(isGlobalSheet).length,
    component: sheets.filter(rules => !isGlobalSheet(rules)).length,
  };

  isolated = new Map();
  for (const path of modulePaths) {
    vi.resetModules();
    const { addCSSHost: addIsolatedHost } = await import('@dineug/r-html');
    await styleModules[path]();
    isolated.set(path, adoptedRules(addIsolatedHost));
  }
});

describe('selector-list scope widening', () => {
  it('scopes all three segments of the CanvasSvg relationship list', () => {
    const rule = cumulative.find(text => text.includes('.relationship:hover'));

    // before (hand-written pipeline — segments 2 and 3 leaked to the whole document):
    //   `${scope} .relationship:hover, .relationship[data-hover],
    //    .relationship.identification[data-hover] { stroke: var(--relationship-hover); }`
    expect(rule).toBe(
      `${canvasSvgScope} .relationship:hover,` +
        `${canvasSvgScope} .relationship[data-hover],` +
        `${canvasSvgScope} .relationship.identification[data-hover]` +
        ' { stroke: var(--relationship-hover); }'
    );
  });

  it('leaves no unscoped segment in that list', () => {
    const rule = cumulative.find(text =>
      text.includes('.relationship:hover')
    ) as string;
    const segments = selectorOf(rule).split(',');

    expect(segments).toHaveLength(3);
    for (const segment of segments) {
      expect(segment.startsWith(`${canvasSvgScope} `)).toBe(true);
    }
  });

  it('is the only selector list a scoped template emits, and it is fully scoped', () => {
    // Sweep: `CanvasSvg.styles.ts:17-19` is the single scoped `css``` site in the repository whose
    // prelude is a comma list. The commas in `Switch.styles.ts:22-23,99` are inside declaration
    // values, and `colorPicker.style.ts` has 38 lists of its own but is `css.global`, so none of
    // them is scoped and none of them is counted here. Should another list appear, this assertion
    // widens to it automatically because it reads every adopted rule of every scoped template.
    const lists = componentRules.filter(text => selectorOf(text).includes(','));

    expect(lists).toHaveLength(1);
    for (const list of lists) {
      for (const segment of selectorOf(list).split(',')) {
        expect(segment).toMatch(SCOPE_CLASS);
      }
    }
  });

  it('leaves the global bucket lists unscoped, which is the whole point of css.global', () => {
    // `reset.styles.ts` became a `css.global` literal in P4. Its eight comma lists are type
    // selectors, pseudo elements and the universal selector — a scope class on any of them would
    // stop it matching.
    //
    // 8 -> 46: the color picker fold adds 38. Its lists are the same shape of thing for the same
    // reason — `.easylogic-colorpicker .colorpicker-body .control > .color, … > .empty` names
    // classes the upstream library writes at runtime, and a scope class on them would rename them
    // out from under it. That is the whole content of this assertion, so the added 38 are not a
    // weakening of it: every one of them is checked below.
    const lists = globalRules.filter(text => selectorOf(text).includes(','));

    expect(lists).toHaveLength(46);
    for (const list of lists) {
      expect(list).not.toMatch(SCOPE_CLASS);
    }
  });
});

describe('rule-count invariance', () => {
  it('loads 62 style modules', () => {
    // Does not move with the color picker fold. `colorPicker.style.ts` already matched the
    // `*.style.ts` half of the glob while it was a `/* css */` raw string — it was loaded and
    // registered nothing. What the fold changed is what it emits, not whether it is walked.
    //
    // 61 -> 62: `duplicate-ghost/DuplicateGhost.styles.ts`, the Alt+drag ghost overlay. A new
    // style module is meant to move this number, which is why it is pinned rather than derived.
    expect(modulePaths).toHaveLength(62);
  });

  it('adopts 622 rules, none of them a duplicate', () => {
    // 302 -> 609: the color picker fold, +307. It rendered into a tree `<style>` before, so none
    // of its rules were adopted and none of them were counted here; as a `css.global` literal all
    // 307 are. 609 -> 611: the Alt+drag ghost's two scoped rules. 611 -> 617: the CodeBlock
    // overlay, which splits its one `code` rule into a shared alignment fragment, a scroller, a
    // layer box, a preview and its `*` block, and a textarea with its `::selection`. 617 -> 622:
    // the five collaborative presence rules, all nested into existing templates rather than
    // modules of their own — which is why the sheet count below did not move with them.
    expect(cumulative).toHaveLength(622);
    expect(new Set(cumulative).size).toBe(622);
  });

  it('splits into 327 global rules ahead of 295 component rules', () => {
    // P4 moved reset (12), fonts (1), typography (1) and scrollbar (6) out of tree `<style>`
    // elements and into `adoptedStyleSheets`. A shadow root applies its own `styleSheets` before
    // its `adoptedStyleSheets`, so the only thing keeping the reset ahead of the components now
    // is the bucket — which is what this asserts, positionally.
    //
    // The color picker fold added the fifth global sheet and its 307 rules: 4 -> 5 sheets and
    // 20 -> 327 global rules, while `component` stayed at 158 sheets / 282 rules — which is what
    // says the fold moved a sheet between pools rather than rewriting one. The component half
    // then went 158 -> 160 sheets and 282 -> 284 rules on its own account, when the Alt+drag
    // ghost added its layer and per-entity templates; the global half did not move with it,
    // which is the same statement in the other direction. 160 -> 164 sheets / 284 -> 290 rules is
    // the CodeBlock overlay, on the same terms. 290 -> 295 is collaborative presence, with the
    // sheet count unmoved — the one thing that says those rules nested into existing templates
    // instead of adding a module.
    expect(sheetsOfEachKind).toEqual({ global: 5, component: 164 });
    expect(globalRules).toHaveLength(327);
    expect(componentRules).toHaveLength(295);
    expect(cumulative).toEqual([...globalRules, ...componentRules]);
  });

  it('drops no rule when the modules are loaded together', () => {
    const union = new Set<string>();
    for (const rules of isolated.values()) {
      rules.forEach(rule => union.add(rule));
    }
    const cumulativeSet = new Set(cumulative);
    const droppedByLoadingTogether = [...union].filter(
      rule => !cumulativeSet.has(rule)
    );

    // Identifiers are content hashes now, so a rule's text is the same whether its module is
    // rendered alone or with the other 61 — which is exactly what makes this comparison mean
    // "nothing was lost to dedup" rather than "the class names differ".
    expect(union.size).toBe(622);
    expect(droppedByLoadingTogether).toEqual([]);
  });

  it('gives two templates with the same root declarations their own class', () => {
    // The hand-written pipeline keyed the identifier on the root declaration block alone, so
    // `ColorPicker.container` and `Sash.sash` — both `position: absolute;` — shared one class and
    // therefore one adopted rule. The identifier is the hash of the whole canonical text now, so
    // they get one rule each. This, over five such pairs, is why the raw rule count went 279 -> 282
    // while the distinct set (class names masked) went 253 -> 251.
    expect(colorPickerScope).not.toBe(sashScope);
    expect(cumulative).toContain(`${colorPickerScope} { position: absolute; }`);
    expect(cumulative).toContain(`${sashScope} { position: absolute; }`);
  });
});

describe('empty rules', () => {
  it('discards the two rules whose bodies were empty, keeping their children', () => {
    // `ErdEditor.styles.ts:17` `&.none-focus` and `CodeBlock.styles.ts:59` `&:hover` hold nested
    // rules and no declarations of their own. The old pipeline emitted `.S.none-focus {  }` and
    // `.S:hover {  }`; the compiler discards a rule with no declarations.
    expect(cumulative.filter(text => /\{\s*\}$/.test(text))).toEqual([]);

    expect(cumulative).toContain(
      `${erdEditorScope}.none-focus div[data-focus-border] { border-color: var(--placeholder) !important; }`
    );
    expect(cumulative).toContain(
      `${erdEditorScope}.none-focus div[data-focus-border-bottom] { border-bottom-color: var(--placeholder) !important; }`
    );
    expect(cumulative).toContain(
      `${erdEditorScope}.none-focus input[data-focus-border-bottom] { border-bottom-color: var(--placeholder) !important; }`
    );
    expect(cumulative).toContain(
      `${codeBlockRootScope}:hover ${codeBlockClipboardScope} { opacity: 1; }`
    );
  });
});
