import { describe, expect, it } from 'vite-plus/test';

import * as hintStyles from '@/components/erd/welcome-screen/welcome-hints/WelcomeHints.styles';
import * as styles from '@/components/erd/welcome-screen/WelcomeScreen.styles';
import { typography } from '@/styles/typography.styles';

const source = (template: { strings: ArrayLike<string> }) =>
  Array.from(template.strings).join('');

const all = [...Object.values(styles), ...Object.values(hintStyles)];

describe('WelcomeScreen.styles', () => {
  it('compiles every export to its own class', () => {
    const classes = all.map(String);

    expect(classes.every(name => /\S/.test(name))).toBe(true);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it('lays the screen over the whole canvas and lets every press through it', () => {
    const root = source(styles.root);

    expect(root).toContain('position: absolute');
    expect(root).toContain('inset: 0');
    expect(root).toContain('pointer-events: none');
    expect(root).toContain('user-select: none');
  });

  it('takes the pointer back for the menu alone', () => {
    const takers = all.filter(template =>
      source(template).includes('pointer-events: auto')
    );

    expect(takers).toEqual([styles.menu]);
  });

  it('centres the block over the floating toolbar, with the heading in the body size', () => {
    expect(source(styles.center)).toContain('justify-content: center');
    expect(source(styles.center)).toContain('align-items: center');
    expect(source(styles.center)).toContain('inset-block: 0 60px');
    expect(styles.heading.values).toContain(typography.normal);
  });

  it('rings a row the keyboard reaches and tints one the pointer is over', () => {
    const item = source(styles.item);

    expect(item).toContain('&:focus-visible');
    expect(item).toContain('var(--input-active)');
    expect(item).toContain('&:hover');
    expect(item).toContain('var(--context-menu-hover)');
    expect(item).toContain('text-align: start');
  });

  it('sets the hint under the toolbar just below it, and the one over the floating toolbar clear of it', () => {
    expect(source(hintStyles.up)).toContain('top: 4px');
    expect(source(hintStyles.down)).toContain('bottom: 68px');
    expect(source(hintStyles.down)).toContain('margin-inline: auto');
  });

  it('wraps a hint label between phrases, which Chromium reads for Japanese alone', () => {
    expect(source(hintStyles.label)).toContain('max-width: 220px');
    expect(source(hintStyles.label)).toContain('word-break: auto-phrase');
  });

  it('writes every side in logical terms, so a right-to-left language mirrors it', () => {
    for (const template of all) {
      expect(source(template)).not.toMatch(
        /(^|[^-])(left|right)\s*:|margin-(left|right)|padding-(left|right)/
      );
    }
  });

  it('declares no fill, the arrows taking theirs from attributes', () => {
    for (const template of all) {
      expect(source(template)).not.toMatch(/(^|[^-])fill\s*:/);
    }
  });
});
