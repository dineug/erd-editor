import { describe, expect, it } from 'vitest';

import { createColorPickerStyle } from '@/styles/colorPicker.style';

function parse(style: HTMLStyleElement) {
  document.head.append(style);
  const rules = Array.from(style.sheet?.cssRules ?? []) as CSSStyleRule[];
  style.remove();
  return rules;
}

function ruleOf(rules: CSSStyleRule[], selector: string) {
  const rule = rules.find(
    r => r.selectorText.replace(/\s+/g, ' ').trim() === selector
  );
  if (!rule) {
    throw new Error(`missing rule: ${selector}`);
  }
  return rule;
}

describe('colorPicker.style', () => {
  it('creates a detached <style> element per call', () => {
    const a = createColorPickerStyle();
    const b = createColorPickerStyle();

    expect(a).toBeInstanceOf(HTMLStyleElement);
    expect(a.tagName).toBe('STYLE');
    expect(a.parentNode).toBeNull();
    expect(a).not.toBe(b);
    expect(a.textContent).toBe(b.textContent);
  });

  it('parses into a large, non empty stylesheet', () => {
    const rules = parse(createColorPickerStyle());

    expect(rules.length).toBeGreaterThan(200);
    for (const rule of rules) {
      expect(rule.selectorText).toBeTruthy();
    }
  });

  it('scopes every rule to the easylogic colorpicker or its context menu', () => {
    const rules = parse(createColorPickerStyle());
    const unscoped = rules
      .map(rule => rule.selectorText.replace(/\s+/g, ' ').trim())
      .filter(
        selector =>
          !selector.includes('.easylogic-colorpicker') &&
          !selector.includes('.colorsets-contextmenu')
      );

    expect(unscoped).toEqual([]);
  });

  it('anchors the picker as a 224px wide floating panel', () => {
    const rule = ruleOf(
      parse(createColorPickerStyle()),
      '.easylogic-colorpicker'
    );

    expect(rule.style.getPropertyValue('position')).toBe('relative');
    expect(rule.style.getPropertyValue('width')).toBe('224px');
    expect(rule.style.getPropertyValue('z-index')).toBe('1000');
    expect(rule.style.getPropertyValue('display')).toBe('inline-block');
    expect(rule.style.getPropertyValue('border-radius')).toBe('3px');
  });

  it('themes the panel chrome with the context menu custom properties', () => {
    const rule = ruleOf(
      parse(createColorPickerStyle()),
      '.easylogic-colorpicker'
    );

    expect(rule.style.getPropertyValue('background-color')).toBe(
      'var(--context-menu-background)'
    );
    expect(rule.style.getPropertyValue('border-color')).toBe(
      'var(--context-menu-border)'
    );
  });

  it('only depends on theme custom properties the editor actually defines', () => {
    const css = createColorPickerStyle().textContent ?? '';
    const used = Array.from(css.matchAll(/var\((--[a-z-]+)\)/g)).map(
      match => match[1]
    );

    expect(new Set(used)).toEqual(
      new Set([
        '--context-menu-border',
        '--context-menu-background',
        '--active',
        '--foreground',
      ])
    );
  });

  it('hides the arrow decoration by default', () => {
    const rule = ruleOf(
      parse(createColorPickerStyle()),
      '.easylogic-colorpicker > .arrow'
    );

    expect(rule.style.getPropertyValue('display')).toBe('none');
    expect(rule.style.getPropertyValue('pointer-events')).toBe('none');
  });

  it('keeps the color chooser overlay transparent and click through until .open', () => {
    const rules = parse(createColorPickerStyle());
    const overlay = ruleOf(
      rules,
      '.easylogic-colorpicker .colorpicker-body .color-chooser'
    );
    const open = ruleOf(
      rules,
      '.easylogic-colorpicker .colorpicker-body .color-chooser.open'
    );

    expect(overlay.style.getPropertyValue('position')).toBe('absolute');
    expect(overlay.style.getPropertyValue('top')).toBe('0px');
    expect(overlay.style.getPropertyValue('opacity')).toBe('0');
    expect(overlay.style.getPropertyValue('pointer-events')).toBe('none');
    expect(open.style.getPropertyValue('opacity')).toBe('1');
    expect(open.style.getPropertyValue('pointer-events')).toBe('all');
  });

  it('positions the chooser container below the 120px tall header area', () => {
    const rule = ruleOf(
      parse(createColorPickerStyle()),
      '.easylogic-colorpicker .colorpicker-body .color-chooser .color-chooser-container'
    );

    expect(rule.style.getPropertyValue('position')).toBe('absolute');
    expect(rule.style.getPropertyValue('top')).toBe('120px');
    expect(rule.style.getPropertyValue('background-color')).toBe(
      'var(--context-menu-background)'
    );
  });

  it('supports the hide-colorsets modifier', () => {
    const rule = ruleOf(
      parse(createColorPickerStyle()),
      '.easylogic-colorpicker.hide-colorsets .colorsets'
    );

    expect(rule.style.getPropertyValue('display')).toBe('none');
    expect(rule.style.getPropertyPriority('display')).toBe('important');
  });

  it('keeps the colorsets context menu hidden until .show is applied', () => {
    const rules = parse(createColorPickerStyle());

    expect(
      ruleOf(rules, '.colorsets-contextmenu').style.getPropertyValue('display')
    ).toBe('none');
    expect(
      ruleOf(rules, '.colorsets-contextmenu.show').style.getPropertyValue(
        'display'
      )
    ).toBe('inline-block');
    expect(
      ruleOf(rules, '.colorsets-contextmenu').style.getPropertyValue('position')
    ).toBe('fixed');
  });

  it('highlights context menu items on hover', () => {
    const rule = ruleOf(
      parse(createColorPickerStyle()),
      '.colorsets-contextmenu .menu-item:hover'
    );

    expect(rule.style.getPropertyValue('background-color')).toBe('#5ea3fb');
    expect(rule.style.getPropertyValue('color')).toBe('white');
  });

  it('ships the layout primitives the picker markup relies on', () => {
    const css = createColorPickerStyle().textContent ?? '';

    for (const selector of [
      '.colorpicker-body',
      '.color-chooser',
      '.colorsets',
      '.hue',
      '.saturation',
      '.value',
      '.opacity',
      '.information',
      '.drag-bar',
    ]) {
      expect(css).toContain(selector);
    }
  });

  it('credits the upstream project in a leading comment', () => {
    const css = createColorPickerStyle().textContent ?? '';

    expect(css.trimStart().startsWith('/* easylogic-colorpicker */')).toBe(
      true
    );
  });
});
