import { beforeAll, describe, expect, it } from 'vite-plus/test';

import { adoptedRules, ruleOf } from '@/__test-utils__/adoptedCss';
import * as styles from '@/components/primitives/code-block/CodeBlock.styles';

const source = (tpl: { strings: TemplateStringsArray }) =>
  tpl.strings.raw.join('');

/** Read from the emitted CSSOM: the shared block is an interpolation, which source() drops. */
const ALIGNMENT = [
  'padding',
  'font-family',
  'font-size',
  'line-height',
  'letter-spacing',
  'font-weight',
  'font-kerning',
  'font-synthesis',
  'font-variant-ligatures',
  'font-variant-caps',
  'font-style',
  'text-transform',
  'white-space',
  'text-align',
  'text-indent',
  'tab-size',
  '-webkit-text-size-adjust',
];

let rules: CSSStyleRule[] = [];

beforeAll(() => {
  rules = adoptedRules();
});

describe('CodeBlock.styles', () => {
  it('exports the six css template literals the component renders with', () => {
    expect(styles.root).toBeTruthy();
    expect(styles.scroller).toBeTruthy();
    expect(styles.layers).toBeTruthy();
    expect(styles.preview).toBeTruthy();
    expect(styles.textarea).toBeTruthy();
    expect(styles.clipboard).toBeTruthy();
  });

  it('resolves every export to a distinct non-empty class identifier', () => {
    const identifiers = [
      String(styles.root),
      String(styles.scroller),
      String(styles.layers),
      String(styles.preview),
      String(styles.textarea),
      String(styles.clipboard),
    ];

    identifiers.forEach(identifier => {
      expect(typeof identifier).toBe('string');
      expect(identifier.length).toBeGreaterThan(0);
    });
    expect(new Set(identifiers).size).toBe(6);
  });

  it('positions the clipboard button and drives it from the foreground/active tokens', () => {
    const clipboard = source(styles.clipboard);

    expect(clipboard).toContain('position: absolute');
    expect(clipboard).toContain('top: 0');
    expect(clipboard).toContain('right: 0');
    expect(clipboard).toContain('cursor: pointer');
    expect(clipboard).toContain('opacity: 0');
    expect(clipboard).toContain('var(--foreground)');
    expect(clipboard).toContain('var(--active)');
  });

  it('reveals the clipboard button from the root hover rule', () => {
    expect(source(styles.root)).toContain('&:hover');
    expect(source(styles.root)).toContain('opacity: 1');
    expect(styles.root.values).toContain(styles.clipboard);
  });

  it('draws no focus ring, so the overlay never outlines the code it sits on', () => {
    expect(
      rules.filter(rule => rule.selectorText.includes(':focus'))
    ).toHaveLength(0);
    expect(source(styles.root)).not.toContain('outline: 1px');
    expect(source(styles.textarea)).not.toContain('outline:');
  });

  it('makes the root a relative, overflow-hidden box', () => {
    const root = source(styles.root);

    expect(root).toContain('position: relative');
    expect(root).toContain('overflow: hidden');
    expect(root).toContain('min-height: 40px');
  });

  it('gives the component exactly one scroll container', () => {
    const scrolling = rules.filter(
      rule => rule.style.getPropertyValue('overflow') === 'auto'
    );

    expect(scrolling).toHaveLength(1);
    expect(scrolling[0].selectorText).toBe(`.${String(styles.scroller)}`);
  });

  it('leaves the scroll container in flow, so the root keeps a content height', () => {
    const scroller = ruleOf(rules, `.${String(styles.scroller)}`);

    // out of flow, the root — whose only other child is the absolute clipboard button — has
    // nothing to size itself from wherever the parent chain is height-indefinite
    expect(scroller.style.getPropertyValue('position')).toBe('');
    expect(scroller.style.getPropertyValue('inset')).toBe('');
    expect(scroller.style.getPropertyValue('width')).toBe('100%');
    expect(scroller.style.getPropertyValue('height')).toBe('100%');
  });

  it('forbids the overlay a scroll offset of its own', () => {
    const textarea = ruleOf(rules, `.${String(styles.textarea)}`);

    expect(textarea.style.getPropertyValue('overflow')).toBe('hidden');
    expect(textarea.style.getPropertyValue('position')).toBe('absolute');
    expect(textarea.style.getPropertyValue('resize')).toBe('none');
  });

  it('sizes the layer box to its content so the overlay can be stretched onto it', () => {
    const layers = ruleOf(rules, `.${String(styles.layers)}`);

    expect(layers.style.getPropertyValue('position')).toBe('relative');
    expect(layers.style.getPropertyValue('width')).toBe('max-content');
    expect(layers.style.getPropertyValue('min-width')).toBe('100%');
    expect(layers.style.getPropertyValue('min-height')).toBe('100%');
  });

  it('states every glyph-moving property identically on both layers', () => {
    const preview = ruleOf(rules, `.${String(styles.preview)}`);
    const textarea = ruleOf(rules, `.${String(styles.textarea)}`);

    // word-spacing is the one declaration in the shared fragment happy-dom's parser drops, so it
    // rests on the two templates splicing in the same fragment object rather than on the loop
    expect(styles.preview.values[0]).toBeTruthy();
    expect(styles.preview.values[0]).toBe(styles.textarea.values[0]);

    for (const property of ALIGNMENT) {
      const value = preview.style.getPropertyValue(property);
      expect(value).not.toBe('');
      expect(textarea.style.getPropertyValue(property)).toBe(value);
    }
    expect(preview.style.getPropertyValue('font-family')).toBe(
      'var(--code-font-family)'
    );
    expect(preview.style.getPropertyValue('white-space')).toBe('pre');
  });

  it('hands the shiki markup the layer typography the UA takes away from pre and code', () => {
    const inherited = ruleOf(rules, `.${String(styles.preview)} *`);

    expect(inherited.style.getPropertyValue('font-family')).toBe('inherit');
    expect(inherited.style.getPropertyValue('font-size')).toBe('inherit');
    expect(inherited.style.getPropertyValue('line-height')).toBe('inherit');
    expect(inherited.style.getPropertyValue('letter-spacing')).toBe('inherit');
    expect(inherited.style.getPropertyValue('margin')).toBe('0px');
    expect(inherited.style.getPropertyValue('padding')).toBe('0px');
  });

  it('paints the preview and hides the overlay text without hiding its caret', () => {
    const preview = ruleOf(rules, `.${String(styles.preview)}`);
    const textarea = ruleOf(rules, `.${String(styles.textarea)}`);

    expect(preview.style.getPropertyValue('color')).toBe('var(--active)');
    expect(preview.style.getPropertyValue('pointer-events')).toBe('none');
    expect(preview.style.getPropertyValue('user-select')).toBe('none');
    // WebKit drops the unprefixed property, and nothing in this pipeline autoprefixes
    expect(preview.style.getPropertyValue('-webkit-user-select')).toBe('none');

    expect(textarea.style.getPropertyValue('color')).toBe('transparent');
    expect(textarea.style.getPropertyValue('background-color')).toBe(
      'transparent'
    );
    expect(textarea.style.getPropertyValue('caret-color')).toBe(
      'var(--active)'
    );
    expect(textarea.style.getPropertyValue('pointer-events')).toBe('');
    expect(textarea.style.getPropertyValue('user-select')).toBe('');
  });

  it('paints the selection band from a translucent token over the highlighted code', () => {
    const selection = ruleOf(rules, `.${String(styles.textarea)}::selection`);

    expect(selection.style.getPropertyValue('color')).toBe('transparent');
    expect(selection.style.getPropertyValue('background-color')).toBe(
      'var(--placeholder)'
    );
  });
});
