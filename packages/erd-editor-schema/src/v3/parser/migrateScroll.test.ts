import { describe, expect, it } from 'vite-plus/test';

import {
  type LegacyScrollBox,
  migrateScrollToOrigin,
} from '@/v3/parser/migrateScroll';

const widths = [2000, 3333, 20_000];
const heights = [2000, 3333, 20_000];
const zoomLevels = [0.1, 0.5, 1, 1.5];
const scrolls = [0, -137.25, 1234.5];

const term = (length: number, zoomLevel: number) =>
  (length * (1 - zoomLevel)) / 2;

const boxes: LegacyScrollBox[] = widths.flatMap((width, index) =>
  zoomLevels.flatMap(zoomLevel =>
    scrolls.map(scroll => ({
      width,
      height: heights[index],
      zoomLevel,
      scrollLeft: scroll,
      scrollTop: -scroll,
    }))
  )
);

const label = ({ width, height, zoomLevel, scrollLeft }: LegacyScrollBox) =>
  `${width}x${height} @ ${zoomLevel} from ${scrollLeft}`;

describe('migrateScrollToOrigin', () => {
  it.each(boxes.map(box => [label(box), box] as const))(
    'adds the box centring term (%s)',
    (_label, box) => {
      const origin = migrateScrollToOrigin(box);

      expect(origin.originX).toBeCloseTo(
        box.scrollLeft + term(box.width, box.zoomLevel),
        4
      );
      expect(origin.originY).toBeCloseTo(
        box.scrollTop + term(box.height, box.zoomLevel),
        4
      );
    }
  );

  it('is the legacy scroll itself at zoom 1, where the term vanishes', () => {
    const box: LegacyScrollBox = {
      width: 3333,
      height: 2000,
      zoomLevel: 1,
      scrollLeft: -137.25,
      scrollTop: 1234.5,
    };

    expect(migrateScrollToOrigin(box)).toEqual({
      originX: box.scrollLeft,
      originY: box.scrollTop,
    });
  });

  it('moves the origin the other way above zoom 1', () => {
    const origin = migrateScrollToOrigin({
      width: 2000,
      height: 2000,
      zoomLevel: 1.5,
      scrollLeft: 0,
      scrollTop: 0,
    });

    expect(origin.originX).toBeCloseTo(-500, 4);
    expect(origin.originY).toBeCloseTo(-500, 4);
  });

  it('rounds to four decimals rather than carrying float noise', () => {
    const origin = migrateScrollToOrigin({
      width: 3333,
      height: 3333,
      zoomLevel: 0.1,
      scrollLeft: 0.1,
      scrollTop: 0.2,
    });

    expect(origin.originX).toBe(1499.95);
    expect(origin.originY).toBe(1500.05);
  });

  it('does not mutate the box it is handed', () => {
    const box: LegacyScrollBox = {
      width: 2000,
      height: 2000,
      zoomLevel: 0.5,
      scrollLeft: 10,
      scrollTop: 20,
    };
    const before = { ...box };

    migrateScrollToOrigin(box);

    expect(box).toEqual(before);
  });

  it('reads the five legacy fields and nothing beside them', () => {
    const box: LegacyScrollBox = {
      width: 2000,
      height: 2000,
      zoomLevel: 0.5,
      scrollLeft: 10,
      scrollTop: 20,
    };
    const carrying = { ...box, originX: 999, originY: 999 };

    expect(migrateScrollToOrigin(carrying)).toEqual(migrateScrollToOrigin(box));
  });
});
