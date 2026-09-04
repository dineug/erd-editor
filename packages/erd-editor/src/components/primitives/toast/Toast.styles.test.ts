import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/toast/Toast.styles';
import { fontSize2, typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('Toast.styles', () => {
  it('exports every section token as a distinct class identifier', () => {
    const identifiers = [
      styles.root,
      styles.indicator,
      styles.textWrap,
      styles.title,
      styles.description,
      styles.action,
    ].map(String);

    for (const identifier of identifiers) {
      expect(identifier.length).toBeGreaterThan(0);
    }
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('paints the root from the toast custom properties', () => {
    const text = staticText(styles.root);
    expect(text).toContain('background-color: var(--toast-background)');
    expect(text).toContain('border: 1px solid var(--toast-border)');
    expect(text).toContain('display: flex');
    expect(text).toContain('border-radius: 6px');
  });

  it('paints the ring in the active color over the toast border, turning while busy', () => {
    const text = staticText(styles.indicator);
    expect(text).toContain('color: var(--active)');
    expect(text).toContain("& [data-part='track']");
    expect(text).toContain('stroke: var(--toast-border)');
    expect(text).toContain('stroke: currentColor');
    expect(text).toContain('transition: stroke-dashoffset');
    expect(text).toContain('&[data-busy] svg');
    expect(text).toContain('@keyframes toastSpin');
  });

  it('spaces the stacked text rows apart from each other', () => {
    const text = staticText(styles.textWrap);
    expect(text).toContain('overflow-wrap: anywhere');
    expect(text).toContain('& > div');
    expect(text).toContain('& > div:last-child');
  });

  it('emphasises the title with the active color and font size 2', () => {
    expect(staticText(styles.title)).toContain('color: var(--active)');
    expect(styles.title.values).toContain(fontSize2);
  });

  it('renders the description with the paragraph typography', () => {
    expect(styles.description.values).toContain(typography.paragraph);
  });

  it('gaps the action buttons apart from the text', () => {
    const text = staticText(styles.action);
    expect(text).toContain('margin-left: 15px');
    expect(text).toContain('& > button');
    expect(text).toContain('& > button:first-child');
  });
});
