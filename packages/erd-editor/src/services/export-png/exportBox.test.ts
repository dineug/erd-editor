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
