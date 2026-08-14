import { describe, expect, it } from 'vitest';

import * as styles from '@/components/erd-editor/ErdEditor.styles';

const rawOf = (template: (typeof styles)['root']) =>
  template.strings.raw.join('');

describe('ErdEditor.styles', () => {
  it('exports the root and scope css template literals', () => {
    expect(styles.root).toBeTruthy();
    expect(styles.scope).toBeTruthy();
    expect(Object.keys(styles).sort()).toEqual(['root', 'scope']);
  });

  it('interpolates the shared container block into both templates', () => {
    expect(styles.root.values.length).toBe(1);
    expect(styles.root.strings.raw.length).toBe(2);
    expect(styles.scope.values.length).toBe(1);
    expect(styles.scope.strings.raw.length).toBe(2);
    expect(styles.root.values[0]).toBe(styles.scope.values[0]);
  });

  it('lays the shared container out as a full-size clipped flex column', () => {
    const container = rawOf(styles.root.values[0] as any);

    expect(container).toContain('display: flex');
    expect(container).toContain('flex-direction: column');
    expect(container).toContain('width: 100%');
    expect(container).toContain('height: 100%');
    expect(container).toContain('overflow: hidden');
    expect(container).toContain('position: relative');
  });

  it('paints the root with the canvas boundary custom property and removes the outline', () => {
    const css = rawOf(styles.root);

    expect(css).toContain(
      'background-color: var(--canvas-boundary-background)'
    );
    expect(css).toContain('outline: none');
  });

  it('greys focus borders out through the none-focus modifier', () => {
    const css = rawOf(styles.root);

    expect(css).toContain('&.none-focus');
    expect(css).toContain('div[data-focus-border]');
    expect(css).toContain('div[data-focus-border-bottom]');
    expect(css).toContain('input[data-focus-border-bottom]');
    expect(css).toContain('border-color: var(--placeholder) !important');
    expect(css).toContain('border-bottom-color: var(--placeholder) !important');
  });

  it('keeps scope as a bare container with no extra declarations', () => {
    const css = rawOf(styles.scope).replace(/\s/g, '');

    expect(css).toBe(';');
  });

  it('resolves each template to a distinct stable class identifier', () => {
    const rootIdentifier = String(styles.root);
    const scopeIdentifier = String(styles.scope);

    expect(rootIdentifier.length).toBeGreaterThan(0);
    expect(scopeIdentifier.length).toBeGreaterThan(0);
    expect(rootIdentifier).not.toBe(scopeIdentifier);
    expect(String(styles.root)).toBe(rootIdentifier);
  });
});
