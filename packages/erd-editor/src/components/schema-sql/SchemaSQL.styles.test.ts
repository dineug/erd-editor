import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/schema-sql/SchemaSQL.styles';

describe('SchemaSQL.styles', () => {
  it('exports the root css template literal without interpolations', () => {
    expect(styles.root).toBeTruthy();
    expect(styles.root.values).toEqual([]);
    expect(styles.root.strings.raw.length).toBe(1);
  });

  it('is a positioning context so the context menu can be absolutely placed', () => {
    expect(styles.root.strings.raw.join('')).toContain('position: relative');
  });

  it('fills the host and clips the code block overflow', () => {
    const css = styles.root.strings.raw.join('');

    expect(css).toContain('width: 100%');
    expect(css).toContain('height: 100%');
    expect(css).toContain('overflow: hidden');
  });

  it('paints the canvas background custom property consumers theme', () => {
    expect(styles.root.strings.raw.join('')).toContain(
      'background-color: var(--canvas-background)'
    );
  });

  it('lays the code and the options panel side by side', () => {
    expect(styles.root.strings.raw.join('')).toContain('display: flex');
  });

  it('gives the code what the panel leaves, never less than nothing', () => {
    const css = styles.code.strings.raw.join('');

    expect(css).toContain('position: relative');
    expect(css).toContain('flex: 1');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('min-height: 0');
  });

  it('paints Show options in the colour the code block sits on', () => {
    expect(styles.show.strings.raw.join('')).toContain(
      'background-color: var(--code-block-background)'
    );
  });

  it('resolves to a stable non-empty class identifier', () => {
    const identifier = String(styles.root);

    expect(typeof identifier).toBe('string');
    expect(identifier.length).toBeGreaterThan(0);
    expect(String(styles.root)).toBe(identifier);
  });
});
