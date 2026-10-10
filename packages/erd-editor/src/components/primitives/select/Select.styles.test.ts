import { beforeAll, describe, expect, it } from 'vite-plus/test';

import { adoptedRules, ruleOf } from '@/__test-utils__/adoptedCss';
import { chevron, root } from '@/components/primitives/select/Select.styles';

// happy-dom splits a shorthand holding var() wrongly, so the declarations are
// read off the template's own text and only the selectors off the sheet.

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

/** The body of one rule of the box, by its selector as the template spells it. */
const ruleBody = (selector: string) => {
  const text = staticText(root);
  const start = text.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`missing rule: ${selector}`);

  return text.slice(start, text.indexOf('}', start));
};

let rules: CSSStyleRule[] = [];
let box = '';
let mark = '';

beforeAll(() => {
  rules = adoptedRules();
  box = `.${String(root)}`;
  mark = `.${String(chevron)}`;
});

describe('Select.styles', () => {
  it('exports the box and its chevron, two classes of their own', () => {
    expect(String(root).startsWith('_')).toBe(true);
    expect(String(chevron).startsWith('_')).toBe(true);
    expect(String(root)).not.toBe(String(chevron));
  });

  it('stacks the list and the chevron in one cell, the list as wide as the box', () => {
    const text = staticText(root);
    expect(text).toContain('display: grid');
    expect(text).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(text).toContain('color: var(--active)');

    const list = ruleBody('& > select');
    expect(list).toContain('grid-area: 1 / 1');
    expect(list).toContain('width: 100%');
    expect(staticText(chevron)).toContain('grid-area: 1 / 1');
  });

  it("turns the browser's arrow off and keeps room for the chevron at the inline end", () => {
    const list = ruleBody('& > select');

    expect(list).toContain('appearance: none');
    expect(list).toContain('padding-inline: 8px 26px');
    expect(list).toContain('height: 28px');
    expect(list).toContain('color: inherit');
    expect(list).toContain('text-overflow: ellipsis');
    expect(list).toContain('border: 1px solid var(--context-menu-border)');
    expect(list).toContain('background-color: var(--context-menu-background)');
  });

  it('sets the chevron at the inline end, letting a press through to the list', () => {
    const text = staticText(chevron);

    expect(text).toContain('justify-self: end');
    expect(text).toContain('margin-inline-end: 7px');
    expect(text).toContain('pointer-events: none');
  });

  it('dims the value and the chevron together, dimmed or disabled', () => {
    expect(ruleBody('&[data-dimmed]')).toContain('color: var(--placeholder)');
    expect(
      ruleOf(rules, `${box}>select:disabled,${box}>select:disabled+${mark}`)
        .cssText
    ).toContain('color: var(--placeholder)');
  });

  it('rings the list the keyboard reaches', () => {
    const text = ruleBody('& > select:focus-visible');

    expect(text).toContain('outline: 2px solid var(--input-active)');
    expect(text).toContain('outline-offset: 1px');
  });

  it('paints the chevron in the system colours when the system forces its own', () => {
    const text = staticText(root);
    const media = text.slice(text.indexOf('@media (forced-colors: active)'));
    expect(media).toContain('color: FieldText');
    expect(media).toContain('color: GrayText');

    const emitted = rules.find(
      rule =>
        rule.cssText.startsWith('@media') &&
        rule.cssText.includes('forced-colors') &&
        rule.cssText.includes(mark)
    );
    expect(emitted?.cssText).toContain(`${box}>${mark}`);
    expect(emitted?.cssText).toContain(`${box}>select:disabled+${mark}`);
  });
});
