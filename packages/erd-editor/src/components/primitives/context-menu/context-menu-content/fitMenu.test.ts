import { describe, expect, it } from 'vite-plus/test';

import { fitMenu } from '@/components/primitives/context-menu/context-menu-content/fitMenu';

const view = { width: 960, height: 540 };

describe('fitMenu', () => {
  it('leaves a menu the window already holds where it is', () => {
    expect(
      fitMenu({ left: 100, top: 60, width: 211.2, height: 306 }, view)
    ).toEqual({ dx: 0, dy: 0 });
  });

  it('moves a root menu back from the right and bottom edges, a whole pixel inside', () => {
    expect(
      fitMenu({ left: 900, top: 400, width: 211.2, height: 306 }, view)
    ).toEqual({ dx: -152, dy: -166 });
  });

  it('never moves a menu larger than the window past its left or top edge', () => {
    expect(
      fitMenu({ left: 300, top: 100, width: 1200, height: 800 }, view)
    ).toEqual({ dx: -300, dy: -100 });
  });

  it('flips a submenu the right edge cuts to end at the left of its row', () => {
    // Its row runs from 757 to 951, and the submenu opened on the right of it.
    const { dx, dy } = fitMenu(
      { left: 951, top: 447, width: 170.3, height: 146 },
      view,
      757
    );

    expect(951 + dx).toBe(586);
    expect(dy).toBe(-53);
  });

  it('keeps a submenu that fits on the right there, whatever room the left has', () => {
    expect(
      fitMenu({ left: 500, top: 60, width: 170, height: 146 }, view, 310)
    ).toEqual({ dx: 0, dy: 0 });
  });

  it('opens a submenu on whichever side the window cuts less when it cuts both', () => {
    const narrow = { width: 300, height: 540 };

    // 170 past the right edge against 83 past the left: the left wins.
    expect(
      fitMenu({ left: 290, top: 0, width: 180, height: 100 }, narrow, 97).dx
    ).toBe(-373);
    // 50 past the right edge against 130 past the left: it stays.
    expect(
      fitMenu({ left: 170, top: 0, width: 180, height: 100 }, narrow, 50).dx
    ).toBe(0);
  });
});
