import { describe, expect, it } from 'vitest';

import * as styles from '@/components/erd/drag-select/DragSelect.styles';

describe('DragSelect.styles', () => {
  it('exposes `dragSelect` as a css template compiled to a class identifier', () => {
    expect(styles.dragSelect).toBeTruthy();
    expect(String(styles.dragSelect)).toMatch(/\S/);
  });

  it('positions the selection box absolutely and lets clicks pass through', () => {
    const source = styles.dragSelect.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('pointer-events: none');
  });

  it('themes the stroke and fill from the drag select custom properties', () => {
    const source = styles.dragSelect.strings.join('');

    expect(source).toContain('stroke: var(--drag-select-border)');
    expect(source).toContain('fill: var(--drag-select-background)');
  });

  it('is a static template with no interpolated values', () => {
    expect(styles.dragSelect.values).toEqual([]);
  });
});
