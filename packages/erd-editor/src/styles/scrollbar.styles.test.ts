import { describe, expect, it } from 'vitest';

import { createScrollbarStyle } from '@/styles/scrollbar.styles';

function parse(style: HTMLStyleElement) {
  document.head.append(style);
  const rules = Array.from(style.sheet?.cssRules ?? []) as CSSStyleRule[];
  style.remove();
  return rules;
}

function ruleOf(rules: CSSStyleRule[], selector: string) {
  const rule = rules.find(r => r.selectorText === selector);
  if (!rule) {
    throw new Error(`missing rule: ${selector}`);
  }
  return rule;
}

describe('scrollbar.styles', () => {
  it('creates a detached <style> element per call', () => {
    const a = createScrollbarStyle();
    const b = createScrollbarStyle();

    expect(a).toBeInstanceOf(HTMLStyleElement);
    expect(a.parentNode).toBeNull();
    expect(a).not.toBe(b);
    expect(a.textContent).toBe(b.textContent);
  });

  it('defines every webkit scrollbar pseudo element plus the .scrollbar class', () => {
    const rules = parse(createScrollbarStyle());

    expect(rules.map(rule => rule.selectorText)).toEqual([
      '::-webkit-scrollbar',
      '::-webkit-scrollbar-track',
      '::-webkit-scrollbar-corner',
      '::-webkit-scrollbar-thumb',
      '::-webkit-scrollbar-thumb:hover',
      '.scrollbar',
    ]);
  });

  it('sizes the scrollbar to 8px in both axes', () => {
    const rule = ruleOf(parse(createScrollbarStyle()), '::-webkit-scrollbar');

    expect(rule.style.getPropertyValue('width')).toBe('8px');
    expect(rule.style.getPropertyValue('height')).toBe('8px');
  });

  it('wires track, thumb and hover backgrounds to theme custom properties', () => {
    const rules = parse(createScrollbarStyle());

    expect(
      ruleOf(rules, '::-webkit-scrollbar-track').style.getPropertyValue(
        'background'
      )
    ).toBe('var(--scrollbar-track)');
    expect(
      ruleOf(rules, '::-webkit-scrollbar-thumb').style.getPropertyValue(
        'background'
      )
    ).toBe('var(--scrollbar-thumb)');
    expect(
      ruleOf(rules, '::-webkit-scrollbar-thumb:hover').style.getPropertyValue(
        'background'
      )
    ).toBe('var(--scrollbar-thumb-hover)');
  });

  it('keeps the scrollbar corner transparent', () => {
    const rule = ruleOf(
      parse(createScrollbarStyle()),
      '::-webkit-scrollbar-corner'
    );

    expect(rule.style.getPropertyValue('background')).toBe('transparent');
  });

  it('exposes a standards based .scrollbar opt-in class', () => {
    const rule = ruleOf(parse(createScrollbarStyle()), '.scrollbar');

    expect(rule.style.getPropertyValue('scrollbar-color')).toBe(
      'var(--scrollbar-thumb) var(--scrollbar-track)'
    );
    expect(rule.style.getPropertyValue('scrollbar-width')).toBe('thin');
  });
});
