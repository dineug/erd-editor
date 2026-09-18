import { describe, expect, it } from 'vite-plus/test';

import { TABLE_CORNER_RADIUS } from '@/components/erd/canvas/sceneTokens';
import { getColorEdgePath } from '@/components/erd/canvas/table/colorEdge';
import { TABLE_BORDER, TABLE_COLOR_WIDTH } from '@/constants/layout';

const OUTER_RADIUS = TABLE_CORNER_RADIUS + TABLE_BORDER / 2;

describe('the colour edge a table wears', () => {
  it('runs down the left side between two arcs of the card outline', () => {
    // The strip's inner side meets a 6.5 corner 4 units in at half a unit down.
    expect(getColorEdgePath(42)).toBe(
      [
        `M ${TABLE_COLOR_WIDTH} 0.5`,
        `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 0 0 ${OUTER_RADIUS}`,
        `L 0 ${42 - OUTER_RADIUS}`,
        `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 0 ${TABLE_COLOR_WIDTH} 41.5`,
        'Z',
      ].join(' ')
    );
  });

  it('keeps both arcs on a card shorter than its two corners', () => {
    const path = getColorEdgePath(8);

    expect(path).toContain('A 4 4 0 0 0 0 4');
    expect(path).toContain('L 0 4');
    expect(path).not.toContain('NaN');
  });
});
