import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/highlighted-text/HighlightedText.styles';

describe('HighlightedText.styles', () => {
  it('exposes `highlighted` as a css template compiled to a class identifier', () => {
    expect(styles.highlighted).toBeTruthy();
    expect(String(styles.highlighted)).toMatch(/\S/);
  });

  it('paints the highlighted chunk with the theme accent custom property', () => {
    expect(styles.highlighted.strings.join('')).toContain(
      'color: var(--active)'
    );
  });
});
