import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/focus-view/FocusView.styles';
import * as toolbarStyles from '@/components/toolbar/Toolbar.styles';
import { FOCUS_BAR_HEIGHT } from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

describe('FocusView.styles', () => {
  it('compiles every export to a distinct non empty class identifier', () => {
    const names = [
      styles.root,
      styles.scene,
      styles.bar,
      styles.label,
      styles.menu,
    ].map(String);

    names.forEach(name => expect(name).toMatch(/\S/));
    expect(new Set(names).size).toBe(names.length);
  });

  it('lays the overlay on the bottom edge, raised the one step the panels of a tab raise themselves', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('left: 0');
    expect(source).toContain('bottom: 0');
    expect(source).toContain('z-index: 1');
    expect(source).toContain('overflow: hidden');
    expect(source).toContain(
      'background-color: var(--canvas-boundary-background)'
    );
    expect(styles.root.values).toEqual([]);
  });

  /**
   * The bar is drawn over the top of the scene box, so the map and its frame
   * are set down by its height or their top rows are under it. The frame is
   * hooked by a class of its own, so the rule reaches it as it reaches the map.
   */
  it('sets the map, its frame and its handle down by the height of the bar', () => {
    const source = styles.scene.strings.join('');

    expect(source).toContain('& > .minimap,');
    expect(source).toContain('& > .minimap-border,');
    expect(source).toContain('& > .minimap-viewport {');
    expect(source).toContain('margin-top: ');
    expect(styles.scene.values).toEqual([FOCUS_BAR_HEIGHT]);
  });

  it('draws the bar as the toolbar bar, absolutely over the top of the scene at the bar height', () => {
    const source = styles.bar.strings.join('');

    expect(styles.bar.values[0]).toBe(toolbarStyles.root);
    expect(source).toContain('position: absolute');
    expect(source).toContain('top: 0');
    expect(source).toContain('left: 0');
    expect(source).toContain('right: 0');
    expect(source).toContain('z-index: 1');
    expect(source).toContain('height: ');
    expect(styles.bar.values).toContain(FOCUS_BAR_HEIGHT);
    expect(styles.bar.values).toContain(typography.paragraph);
  });

  it('draws each control as a toolbar menu, with the disabled state of the trail ends on top', () => {
    const source = styles.menu.strings.join('');

    expect(styles.menu.values).toEqual([toolbarStyles.menu]);
    expect(source).toContain('&.disabled');
    expect(source).toContain('cursor: not-allowed');
    expect(source).toContain('color: var(--placeholder)');
  });

  it('clips a long label short of the controls beside it', () => {
    const source = styles.label.strings.join('');

    expect(source).toContain('max-width: 320px');
    expect(source).toContain('overflow: hidden');
    expect(source).toContain('text-overflow: ellipsis');
    expect(styles.label.values).toEqual([]);
  });
});
