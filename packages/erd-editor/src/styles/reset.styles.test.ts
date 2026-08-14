import { describe, expect, it } from 'vitest';

import { createResetStyle } from '@/styles/reset.styles';

function parse(style: HTMLStyleElement) {
  document.head.append(style);
  const rules = Array.from(style.sheet?.cssRules ?? []) as CSSStyleRule[];
  style.remove();
  return rules;
}

function selectors(rules: CSSStyleRule[]) {
  return rules.map(rule =>
    rule.selectorText
      .split(',')
      .map(part => part.trim())
      .join(', ')
  );
}

function ruleOf(rules: CSSStyleRule[], normalizedSelector: string) {
  const index = selectors(rules).indexOf(normalizedSelector);
  if (index === -1) {
    throw new Error(`missing rule: ${normalizedSelector}`);
  }
  return rules[index];
}

describe('reset.styles', () => {
  it('creates a detached <style> element per call', () => {
    const a = createResetStyle();
    const b = createResetStyle();

    expect(a).toBeInstanceOf(HTMLStyleElement);
    expect(a.tagName).toBe('STYLE');
    expect(a.parentNode).toBeNull();
    expect(a).not.toBe(b);
    expect(a.textContent).toBe(b.textContent);
  });

  it('emits every reset rule in source order', () => {
    const rules = parse(createResetStyle());

    expect(selectors(rules)).toEqual([
      'p, ol, ul, li, dl, dt, dd, blockquote, figure, fieldset, legend, textarea, pre, iframe, hr, h1, h2, h3, h4, h5, h6',
      'h1, h2, h3, h4, h5, h6',
      'ul',
      'button, input, select, textarea',
      'input::placeholder, textarea::placeholder',
      'input:disabled, textarea:disabled',
      '*, *::before, *::after',
      'img, video',
      'iframe',
      'table',
      'td, th',
      ':host',
    ]);
  });

  it('zeroes margin and padding on flow content', () => {
    const rule = parse(createResetStyle())[0];

    expect(rule.style.getPropertyValue('margin')).toBe('0px');
    expect(rule.style.getPropertyValue('padding')).toBe('0px');
  });

  it('flattens heading typography', () => {
    const rule = ruleOf(parse(createResetStyle()), 'h1, h2, h3, h4, h5, h6');

    expect(rule.style.getPropertyValue('font-size')).toBe('100%');
    expect(rule.style.getPropertyValue('font-weight')).toBe('normal');
  });

  it('removes list markers from ul', () => {
    const rule = ruleOf(parse(createResetStyle()), 'ul');

    expect(rule.style.getPropertyValue('list-style')).toBe('none');
  });

  it('makes form controls inherit the editor font and active color', () => {
    const rule = ruleOf(
      parse(createResetStyle()),
      'button, input, select, textarea'
    );

    expect(rule.style.getPropertyValue('font-family')).toBe(
      'var(--text-font-family)'
    );
    expect(rule.style.getPropertyValue('color')).toBe('var(--active)');
    expect(rule.style.getPropertyValue('background-color')).toBe('inherit');
    expect(rule.style.getPropertyValue('padding')).toBe('0px');
  });

  it('styles placeholders with the placeholder color at full opacity', () => {
    const rule = ruleOf(
      parse(createResetStyle()),
      'input::placeholder, textarea::placeholder'
    );

    expect(rule.style.getPropertyValue('color')).toBe('var(--placeholder)');
    expect(rule.style.getPropertyValue('opacity')).toBe('1');
    expect(rule.style.getPropertyValue('font-family')).toBe(
      'var(--text-font-family)'
    );
  });

  it('dims disabled inputs and shows a not-allowed cursor', () => {
    const rule = ruleOf(
      parse(createResetStyle()),
      'input:disabled, textarea:disabled'
    );

    expect(rule.style.getPropertyValue('cursor')).toBe('not-allowed');
    expect(rule.style.getPropertyValue('opacity')).toBe('0.5');
  });

  it('applies border-box sizing to every element and pseudo element', () => {
    const rule = ruleOf(parse(createResetStyle()), '*, *::before, *::after');

    expect(rule.style.getPropertyValue('box-sizing')).toBe('border-box');
  });

  it('keeps media responsive and borderless', () => {
    const rules = parse(createResetStyle());
    const media = ruleOf(rules, 'img, video');

    expect(media.style.getPropertyValue('height')).toBe('auto');
    expect(media.style.getPropertyValue('max-width')).toBe('100%');
    expect(ruleOf(rules, 'iframe').style.getPropertyValue('border')).toContain(
      '0'
    );
  });

  it('collapses table borders and zeroes cell padding', () => {
    const rules = parse(createResetStyle());

    expect(
      ruleOf(rules, 'table').style.getPropertyValue('border-collapse')
    ).toBe('collapse');
    expect(
      ruleOf(rules, 'table').style.getPropertyValue('border-spacing')
    ).toBe('0');
    expect(ruleOf(rules, 'td, th').style.getPropertyValue('padding')).toBe(
      '0px'
    );
  });

  it('binds :host to the typography and theme custom properties', () => {
    const rule = ruleOf(parse(createResetStyle()), ':host');

    expect(rule.style.getPropertyValue('font-family')).toBe(
      'var(--text-font-family)'
    );
    expect(rule.style.getPropertyValue('color')).toBe('var(--foreground)');
    expect(rule.style.getPropertyValue('fill')).toBe('var(--foreground)');
    expect(rule.style.getPropertyValue('font-size')).toBe('var(--font-size-2)');
    expect(rule.style.getPropertyValue('letter-spacing')).toBe(
      'var(--letter-spacing-2)'
    );
    expect(rule.style.getPropertyValue('line-height')).toBe(
      'var(--line-height-2)'
    );
    expect(rule.style.getPropertyValue('font-weight')).toBe(
      'var(--font-weight-regular)'
    );
  });

  it('declares outline: none on form controls in the raw css text', () => {
    const style = createResetStyle();

    expect(style.textContent).toContain('outline: none;');
    expect(style.textContent).toContain('border: none;');
  });
});
