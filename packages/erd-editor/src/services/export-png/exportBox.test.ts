import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { Show } from '@/constants/schema';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { getContentRect } from '@/konva/scene/contentBounds';
import { getMemoRect, type Rect } from '@/konva/scene/metrics';
import {
  EXPORT_MARGIN,
  getExportRect,
  getExportScale,
  getExportSize,
  getStageSize,
} from '@/services/export-png/exportBox';
import {
  CANVAS_AREA_MAX,
  CANVAS_SIDE_MAX,
} from '@/services/export-png/pixelRatio';
import { createMemo } from '@/utils/collection/memo.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { getRouteBBox } from '@/utils/draw-relationship';

function createState(): RootState {
  return {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
}

function addMemo(
  state: RootState,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const memo = createMemo({ id, ui: { x, y, width, height } });
  state.collections.memoEntities[id] = memo;
  state.doc.memoIds.push(id);
  return memo;
}

function addRelationship(
  state: RootState,
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const relationship = createRelationship({ id, start, end });
  state.collections.relationshipEntities[id] = relationship;
  state.doc.relationshipIds.push(id);
  return relationship;
}

const inflated = ({ x, y, width, height }: Rect): Rect => ({
  x: x - EXPORT_MARGIN,
  y: y - EXPORT_MARGIN,
  width: width + EXPORT_MARGIN * 2,
  height: height + EXPORT_MARGIN * 2,
});

describe('getExportRect', () => {
  it('is the margin on its own for a document that draws nothing', () => {
    expect(getExportRect(createState())).toEqual(
      inflated({ x: 0, y: 0, width: 0, height: 0 })
    );
  });

  it('is the content rect with the margin around it', () => {
    const state = createState();
    const memo = addMemo(state, 'm1', -3_000, -3_000, 200, 120);

    expect(getExportRect(state)).toEqual(inflated(getMemoRect(memo)));
    expect(getExportRect(state)).toEqual(
      inflated(getContentRect(state) as Rect)
    );
  });

  it('reaches every entity of a document, however far apart they are', () => {
    const state = createState();
    const near = addMemo(state, 'm1', 0, 0, 200, 120);
    const far = addMemo(state, 'm2', 20_000, 0, 200, 120);
    const box = getExportRect(state);

    expect(box.x).toBe(getMemoRect(near).x - EXPORT_MARGIN);
    expect(box.width).toBe(
      getMemoRect(far).x +
        getMemoRect(far).width -
        getMemoRect(near).x +
        EXPORT_MARGIN * 2
    );
  });

  it('holds a connector that reaches past every entity', () => {
    const state = createState();
    addMemo(state, 'm1', 0, 0, 200, 120);
    const relationship = addRelationship(
      state,
      'r1',
      { x: -4_000, y: -4_000 },
      { x: 40, y: 40 }
    );
    const route = getRouteBBox(relationship);

    const box = getExportRect(state);

    expect(box.x).toBe(route.x - EXPORT_MARGIN);
    expect(box.y).toBe(route.y - EXPORT_MARGIN);
  });

  it('leaves the connectors out when the document does not show them', () => {
    const state = createState();
    const memo = addMemo(state, 'm1', 0, 0, 200, 120);
    addRelationship(state, 'r1', { x: -4_000, y: -4_000 }, { x: 40, y: 40 });
    state.settings.show &= ~Show.relationship;

    expect(getExportRect(state)).toEqual(inflated(getMemoRect(memo)));
  });

  it('is the margin alone for a document of connectors and nothing else', () => {
    const state = createState();
    const relationship = addRelationship(
      state,
      'r1',
      { x: 100, y: 100 },
      { x: 300, y: 300 }
    );

    expect(getExportRect(state)).toEqual(inflated(getRouteBBox(relationship)));
  });
});

describe('getExportScale', () => {
  it('keeps every scene unit of a box a canvas can hold', () => {
    expect(getExportScale({ x: 0, y: 0, width: 2_000, height: 2_000 })).toBe(1);
  });

  it('is the zoom the image was asked for, for a box a canvas can hold', () => {
    const box = { x: 0, y: 0, width: 2_000, height: 2_000 };

    expect(getExportScale(box, 0.5)).toBe(0.5);
    expect(getExportScale(box, 1.5)).toBe(1.5);
  });

  it('is the ceiling rather than the zoom where the two disagree', () => {
    const box = { x: 0, y: 0, width: 400_000, height: 360 };
    const ceiling = CANVAS_SIDE_MAX / box.width;

    // A zoom under the ceiling is honoured; one over it is what the ceiling cuts.
    expect(getExportScale(box, ceiling / 2)).toBeCloseTo(ceiling / 2, 12);
    expect(getExportScale(box, 1.5)).toBeCloseTo(ceiling, 12);
  });

  it('reads a zoom of zero or less as no zoom at all, which only a torn state reports', () => {
    const box = { x: 0, y: 0, width: 2_000, height: 2_000 };

    expect(getExportScale(box, 0)).toBe(1);
    expect(getExportScale(box, -1)).toBe(1);
  });

  it('is what brings the longest side back under the side ceiling', () => {
    const box = { x: 0, y: 0, width: 400_000, height: 360 };
    const scale = getExportScale(box);

    expect(scale).toBeCloseTo(CANVAS_SIDE_MAX / box.width, 12);
    expect(box.width * scale).toBeCloseTo(CANVAS_SIDE_MAX, 6);
  });

  it('is what brings the area back under the area ceiling', () => {
    const box = { x: 0, y: 0, width: 30_000, height: 30_000 };
    const scale = getExportScale(box);

    expect(scale).toBeCloseTo(
      Math.sqrt(CANVAS_AREA_MAX / (30_000 * 30_000)),
      12
    );
    expect(box.width * scale * (box.height * scale)).toBeCloseTo(
      CANVAS_AREA_MAX,
      -3
    );
    expect(box.width * scale).toBeLessThanOrEqual(CANVAS_SIDE_MAX);
  });

  it('keeps a box with no area at one image pixel per scene unit', () => {
    expect(getExportScale({ x: 0, y: 0, width: 0, height: 0 })).toBe(1);
  });
});

describe('getExportSize', () => {
  it('is the box times the zoom times the scale for a box a canvas can hold', () => {
    expect(getExportSize({ width: 2_160, height: 1_080 }, 1, 2)).toEqual({
      width: 4_320,
      height: 2_160,
      askedWidth: 4_320,
      askedHeight: 2_160,
      reduced: false,
    });
    expect(getExportSize({ width: 2_160, height: 2_160 }, 0.4, 3)).toEqual({
      width: 2_592,
      height: 2_592,
      askedWidth: 2_592,
      askedHeight: 2_592,
      reduced: false,
    });
  });

  it('truncates a fractional side the way a canvas does', () => {
    const size = getExportSize({ width: 100.9, height: 50.5 }, 1, 1);

    expect([size.width, size.height]).toEqual([100, 50]);
  });

  it('says a scale cut by the area ceiling is reduced, and what was asked', () => {
    const size = getExportSize({ width: 10_000, height: 10_000 }, 1, 2);

    expect(size.reduced).toBe(true);
    expect([size.askedWidth, size.askedHeight]).toEqual([20_000, 20_000]);
    expect(size.width).toBe(Math.floor(Math.sqrt(CANVAS_AREA_MAX)));
    expect(size.width * size.height).toBeLessThanOrEqual(CANVAS_AREA_MAX);
  });

  it('says a zoom cut by the side ceiling is reduced', () => {
    const size = getExportSize({ width: 400_000, height: 360 }, 1, 1);

    expect(size.reduced).toBe(true);
    expect(size.width).toBeLessThanOrEqual(CANVAS_SIDE_MAX);
  });

  it('reads a zoom of zero or less as no zoom at all', () => {
    expect(getExportSize({ width: 300, height: 200 }, 0, 2)).toMatchObject({
      width: 600,
      height: 400,
      reduced: false,
    });
  });

  it('keeps a side the ceilings cut under a pixel at one, as the Stage it is drawn on keeps it', () => {
    const box = { width: 6_000_000, height: 160 };
    const scale = getExportScale({ x: 0, y: 0, ...box }, 1);
    expect(box.height * scale).toBeLessThan(1);

    const size = getExportSize(box, 1, 1);

    expect(size.height).toBe(1);
    expect(size.width).toBeLessThanOrEqual(CANVAS_SIDE_MAX);
    expect(size.reduced).toBe(true);
  });
});

describe('getStageSize', () => {
  it('is the box at the scale', () => {
    expect(getStageSize({ width: 2_000, height: 500 }, 0.5)).toEqual({
      width: 1_000,
      height: 250,
    });
  });

  it('keeps each side at a pixel at least, since a canvas truncates a side under one to none', () => {
    expect(getStageSize({ width: 400_000, height: 160 }, 0.0025)).toEqual({
      width: 1_000,
      height: 1,
    });
    expect(getStageSize({ width: 49, height: 49 }, 1 / 49)).toEqual({
      width: 1,
      height: 1,
    });
  });
});
