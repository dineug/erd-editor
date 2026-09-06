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

  it('generates a distinct class identifier per rule set', () => {
    expect(String(styles.stage)).not.toBe(String(styles.controller));
  });

  /**
   * The minimap's thumbnail is a picture of the canvas, so it is painted by
   * the canvas's own rules rather than by a copy of them that could drift.
   */
  it('gives the minimap thumbnail the rules the stage container carries', () => {
    expect(styles.root).toBe(styles.stage);
  });

  it('anchors the stage container at the origin so tables can be absolutely placed', () => {
    const text = staticText(styles.stage);
    expect(text).toContain('position: relative');
    expect(text).toContain('top: 0');
    expect(text).toContain('left: 0');
  });

  /**
   * The container is the screen and the scene draws no document box any more,
   * so this is the one place the canvas colour comes from and it has to reach
   * every corner the reader can scroll to.
   */
  it('paints the stage container from the canvas background custom property', () => {
    expect(staticText(styles.stage)).toContain(
      'background-color: var(--canvas-background)'
    );
  });

  it('hints transform compositing on both the stage and the controller', () => {
    expect(staticText(styles.stage)).toContain('will-change: transform');
    expect(staticText(styles.controller)).toContain('will-change: transform');
  });

  it('keeps the controller free of positioning rules', () => {
    const text = staticText(styles.controller);
    expect(text).not.toContain('position:');
    expect(text).not.toContain('background-color:');
  });
});
