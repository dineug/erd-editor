import { addCSSHost } from '@dineug/r-html';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import {
  cursor,
  ellipsis,
  root,
  userSelect,
} from '@/components/primitives/edit-input/EditInput.styles';

let adoptedRules: string[] = [];

function ruleOf(identifier: string, suffix = '') {
  const selector = `.${identifier}${suffix} `;
  const rule = adoptedRules.find(text => text.startsWith(selector));
  if (!rule) {
    throw new Error(`missing rule for: ${selector}`);
  }
  return rule;
}

beforeAll(() => {
  const host = document.createElement('div').attachShadow({ mode: 'open' });
  addCSSHost(host);
  adoptedRules = host.adoptedStyleSheets.flatMap(sheet =>
    Array.from(sheet.cssRules).map(rule => rule.cssText)
  );
});

describe('EditInput.styles', () => {
  it('exports four css template literals with distinct generated class names', () => {
    const all = [root, cursor, userSelect, ellipsis];

    for (const style of all) {
      expect(Array.isArray(style.strings)).toBe(true);
      expect(style.template.node).toBeTruthy();
      expect(String(style).startsWith('_')).toBe(true);
    }
    expect(new Set(all.map(String)).size).toBe(4);
  });

  it('is stable: stringifying twice yields the same class name', () => {
    expect(String(root)).toBe(String(root));
    expect(String(ellipsis)).toBe(String(ellipsis));
  });

  it('root lays out a 20px inline box on the active color token', () => {
    const text = ruleOf(String(root));

    expect(text).toContain('display: inline-flex');
    expect(text).toContain('height: 20px');
    expect(text).toContain('box-sizing: border-box');
    expect(text).toContain('vertical-align: middle');
    expect(text).toContain('color: var(--active)');
    expect(text).toContain('background-color: transparent');
    expect(text).toContain('line-height: normal');
  });

  it('root inlines the paragraph typography preset', () => {
    const text = ruleOf(String(root));

    expect(text).toContain('font-size: var(--font-size-1)');
    expect(text).toContain('letter-spacing: var(--letter-spacing-1)');
    expect(text).toContain('font-weight: var(--font-weight-regular)');
  });

  it('root starts with a transparent bottom border', () => {
    const text = ruleOf(String(root));

    expect(text).toContain('border-bottom-width: 1.5px');
    expect(text).toContain('border-bottom-style: solid');
    expect(text).toContain('border-bottom-color: transparent');
  });

  it('exposes the placeholder, focus and edit state modifiers consumers toggle', () => {
    expect(ruleOf(String(root), '.placeholder')).toContain(
      'color: var(--placeholder)'
    );
    expect(ruleOf(String(root), '.focus')).toContain(
      'border-bottom-color: var(--focus)'
    );
    expect(ruleOf(String(root), '.edit')).toContain(
      'border-bottom-color: var(--input-active)'
    );
  });

  it('cursor and userSelect are single purpose helpers', () => {
    expect(ruleOf(String(cursor))).toContain('cursor: default');
    expect(ruleOf(String(userSelect))).toContain('user-select: none');
  });

  it('ellipsis truncates a single line of overflowing text', () => {
    const text = ruleOf(String(ellipsis));

    expect(text).toContain('overflow: hidden');
    expect(text).toContain('text-overflow: ellipsis');
    expect(text).toContain('white-space: nowrap');
  });
});
