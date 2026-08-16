import { addCSSHost } from '@dineug/r-html';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import {
  range,
  root,
  thumb,
  track,
} from '@/components/primitives/slider/Slider.styles';

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

describe('Slider.styles', () => {
  it('exports four css template literals with distinct generated class names', () => {
    const all = [root, track, range, thumb];

    for (const style of all) {
      expect(Array.isArray(style.strings)).toBe(true);
      expect(style.template.node).toBeTruthy();
      expect(String(style).startsWith('_')).toBe(true);
    }
    expect(new Set(all.map(String)).size).toBe(4);
  });

  it('is stable: stringifying twice yields the same class name', () => {
    expect(String(root)).toBe(String(root));
    expect(String(thumb)).toBe(String(thumb));
  });

  it('root is a full width, drag friendly flex row', () => {
    const text = ruleOf(String(root));

    expect(text).toContain('display: flex');
    expect(text).toContain('width: 100%');
    expect(text).toContain('height: 12px');
    expect(text).toContain('position: relative');
    expect(text).toContain('user-select: none');
    expect(text).toContain('touch-action: none');
  });

  it('track is a rounded, clipped bar using the gray tokens', () => {
    const text = ruleOf(String(track));

    expect(text).toContain('height: 8px');
    expect(text).toContain('background-color: var(--gray-color-3)');
    expect(text).toContain('box-shadow: inset 0 0 0 1px var(--gray-color-6)');
    expect(text).toContain('overflow: hidden');
    expect(text).toContain('border-radius: 9999px');
  });

  it('range fills the track with the accent token and inherits its radius', () => {
    const text = ruleOf(String(range));

    expect(text).toContain('position: absolute');
    expect(text).toContain('border-radius: inherit');
    expect(text).toContain('background-color: var(--accent-color-9)');
    expect(text).toContain('width: 100%');
    expect(text).toContain('height: 100%');
  });

  it('thumb is a 12px circle', () => {
    const text = ruleOf(String(thumb));

    expect(text).toContain('position: absolute');
    expect(text).toContain('width: 12px');
    expect(text).toContain('height: 12px');
    expect(text).toContain('background-color: white');
    expect(text).toContain('border-radius: 9999px');
  });

  it('thumb grows a 3x invisible hit area through ::before', () => {
    const text = ruleOf(String(thumb), '::before');

    expect(text).toContain('width: calc(12px * 3)');
    expect(text).toContain('height: calc(12px * 3)');
    expect(text).toContain('transform: translate(-50%, -50%)');
  });

  it('thumb paints its visible knob through ::after', () => {
    const text = ruleOf(String(thumb), '::after');

    expect(text).toContain('background-color: white');
    expect(text).toContain('inset: calc(-0.25 * 8px)');
    expect(text).toContain('box-shadow: inset 0 0 0 1px var(--gray-color-6)');
    expect(text).toContain('cursor: pointer');
  });
});
