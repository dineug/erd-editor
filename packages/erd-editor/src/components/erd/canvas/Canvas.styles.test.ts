import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/canvas/Canvas.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('Canvas.styles', () => {
  it('exports the root and controller tokens as css templates', () => {
    for (const name of ['root', 'controller'] as const) {
      const token = styles[name];
      expect(token).toBeTruthy();
      expect(typeof token.toString()).toBe('string');
      expect(token.toString().length).toBeGreaterThan(0);
    }
  });

  it('generates a distinct class identifier per token', () => {
    const identifiers = [styles.root, styles.controller].map(String);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('anchors the root at the origin so tables can be absolutely placed', () => {
    const text = staticText(styles.root);
    expect(text).toContain('position: relative');
    expect(text).toContain('top: 0');
    expect(text).toContain('left: 0');
  });

  it('paints the root from the canvas background custom property', () => {
    expect(staticText(styles.root)).toContain(
      'background-color: var(--canvas-background)'
    );
  });

  it('hints transform compositing on both the root and the controller', () => {
    expect(staticText(styles.root)).toContain('will-change: transform');
    expect(staticText(styles.controller)).toContain('will-change: transform');
  });

  it('keeps the controller free of positioning rules', () => {
    const text = staticText(styles.controller);
    expect(text).not.toContain('position:');
    expect(text).not.toContain('background-color:');
  });
});
