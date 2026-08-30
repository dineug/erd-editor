/// <reference types="vite/client" />
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';

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
 * A css.global sheet is the one kind carrying no generated class anywhere in it.
 * Marker text will not do, because component sheets declare the same
 * properties.
 */
function isGlobalSheet(rules: string[]): boolean {
  return !rules.some(text => SCOPE_CLASS.test(text));
}

function selectorOf(cssText: string): string {
  return cssText.slice(0, cssText.indexOf('{')).trim();
}

/** Every rule adopted when all 62 modules share one module registry. */
let cumulative: string[] = [];
/** The css.global half of cumulative, which the bucket keeps in front. */
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
    //   ${scope} .relationship:hover, .relationship[data-hover],
    //    .relationship.identification[data-hover] { stroke: var(--relationship-hover); }
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
    // CanvasSvg.styles.ts holds the single scoped site whose prelude is a comma
    // list; the other commas are inside declaration values or in a global sheet.
    // A new list widens this automatically, since it reads every adopted rule.
    const lists = componentRules.filter(text => selectorOf(text).includes(','));

    expect(lists).toHaveLength(1);
    for (const list of lists) {
      for (const segment of selectorOf(list).split(',')) {
        expect(segment).toMatch(SCOPE_CLASS);
      }
    }
  });

  it('leaves the global bucket lists unscoped, which is the whole point of css.global', () => {
    // These lists are type selectors, pseudo elements, the universal selector
    // and the picker's own runtime class names. A scope class on any of them
    // would stop it matching, which is what this assertion is about.
    const lists = globalRules.filter(text => selectorOf(text).includes(','));

    expect(lists).toHaveLength(46);
    for (const list of lists) {
      expect(list).not.toMatch(SCOPE_CLASS);
    }
  });
});

describe('rule-count invariance', () => {
  it('loads 62 style modules', () => {
    // A new style module is meant to move this number, which is why it is
    // pinned rather than derived.
    expect(modulePaths).toHaveLength(62);
  });

  it('adopts 622 rules, none of them a duplicate', () => {
    // Pinned rather than derived, so a rule added or lost anywhere in the
    // package has to be accounted for here.
    expect(cumulative).toHaveLength(622);
    expect(new Set(cumulative).size).toBe(622);
  });

  it('splits into 327 global rules ahead of 295 component rules', () => {
    // A shadow root applies its own styleSheets before its adoptedStyleSheets,
    // so the only thing keeping the reset ahead of the components is the bucket,
    // which is what this asserts positionally. Both halves move independently.
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
    // The identifier is the hash of the whole canonical text, not of the root
    // declaration block, so two templates that declare the same one property get
    // a class and an adopted rule each rather than sharing one.
    expect(colorPickerScope).not.toBe(sashScope);
    expect(cumulative).toContain(`${colorPickerScope} { position: absolute; }`);
    expect(cumulative).toContain(`${sashScope} { position: absolute; }`);
  });
});

describe('empty rules', () => {
  it('discards the two rules whose bodies were empty, keeping their children', () => {
    // ErdEditor.styles.ts:17 &.none-focus and CodeBlock.styles.ts:59 &:hover hold nested
    // rules and no declarations of their own. The old pipeline emitted .S.none-focus {  } and
    // .S:hover {  }; the compiler discards a rule with no declarations.
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
