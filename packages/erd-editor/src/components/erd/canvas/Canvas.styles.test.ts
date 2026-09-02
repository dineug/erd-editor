import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/canvas/Canvas.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('Canvas.styles', () => {
  it('exports the root and controller tokens as css templates', () => {
    for (const name of ['root', 'stage', 'controller'] as const) {
      const token = styles[name];
      expect(token).toBeTruthy();
      expect(typeof token.toString()).toBe('string');
      expect(token.toString().length).toBeGreaterThan(0);
    }
  });

  it('generates a distinct class identifier per token', () => {
    const identifiers = [styles.root, styles.stage, styles.controller].map(
      String
    );
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

  it('anchors the stage container at the origin, as the root is anchored', () => {
    const text = staticText(styles.stage);
    expect(text).toContain('position: relative');
    expect(text).toContain('top: 0');
    expect(text).toContain('left: 0');
  });

  /**
   * The container is the screen and the document box is a konva rect inside it,
   * so a background here would paint the canvas colour over the whole viewport
   * and the boundary outside the document would stop being visible at all.
   */
  it('leaves the stage container unpainted so the boundary shows through', () => {
    expect(staticText(styles.stage)).not.toContain('background-color');
  });

  it('hints transform compositing on both the root and the controller', () => {
    expect(staticText(styles.root)).toContain('will-change: transform');
    expect(staticText(styles.stage)).toContain('will-change: transform');
    expect(staticText(styles.controller)).toContain('will-change: transform');
  });

  it('keeps the controller free of positioning rules', () => {
    const text = staticText(styles.controller);
    expect(text).not.toContain('position:');
    expect(text).not.toContain('background-color:');
  });
});
