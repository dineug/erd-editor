import { describe, expect, it } from 'vite-plus/test';

import { Direction } from '@/constants/schema';
import {
  type Anchors,
  MIN_STUB,
  PATH_END_HEIGHT,
  STUB_CYCLE,
  STUB_STEP,
} from '@/utils/draw-relationship';
import {
  clampStub,
  facingGap,
  stubEnds,
  stubFor,
} from '@/utils/draw-relationship/stub';

const facing = (gap: number): Anchors => ({
  start: { tableId: 'A', x: 100, y: 50, direction: Direction.right },
  end: { tableId: 'B', x: 100 + gap, y: 50, direction: Direction.left },
});

describe('stubFor', () => {
  it('keeps slot zero at the historical path end height', () => {
    expect(stubFor(0)).toBe(PATH_END_HEIGHT);
  });

  it('steps each further slot out and wraps every cycle', () => {
    expect(stubFor(1)).toBe(PATH_END_HEIGHT + STUB_STEP);
    expect(stubFor(STUB_CYCLE - 1)).toBe(
      PATH_END_HEIGHT + (STUB_CYCLE - 1) * STUB_STEP
    );
    expect(stubFor(STUB_CYCLE)).toBe(stubFor(0));
  });
});

describe('facingGap', () => {
  it('measures the gap between two anchors pointing at each other', () => {
    const { start, end } = facing(300);

    expect(facingGap(start, end)).toBe(300);
    expect(facingGap(end, start)).toBe(300);
  });

  it('is null for a loop and for anchors that do not face', () => {
    const { start, end } = facing(300);

    expect(facingGap(start, { ...end, tableId: 'A' })).toBeNull();
    expect(facingGap(start, { ...end, direction: Direction.top })).toBeNull();
  });
});

describe('clampStub', () => {
  it('leaves a stub alone with no facing gap', () => {
    expect(clampStub(80, null)).toBe(80);
    expect(clampStub(80, -10)).toBe(80);
  });

  it('cuts a stub to just under half the gap, and never under the minimum', () => {
    expect(clampStub(80, 100)).toBe(49);
    expect(clampStub(80, 40)).toBe(MIN_STUB);
  });
});

describe('stubEnds', () => {
  it('pushes each turning point out from its anchor by the stub its slot asks for', () => {
    const anchors = facing(400);

    const { m, l, startStub, endStub } = stubEnds(anchors, [0, 1]);

    expect(startStub).toBe(PATH_END_HEIGHT);
    expect(endStub).toBe(PATH_END_HEIGHT + STUB_STEP);
    expect(m).toEqual({ x: 100 + PATH_END_HEIGHT, y: 50 });
    expect(l).toEqual({ x: 500 - PATH_END_HEIGHT - STUB_STEP, y: 50 });
  });

  it('works along the y axis for anchors on the top and bottom edges', () => {
    const anchors: Anchors = {
      start: { tableId: 'A', x: 60, y: 100, direction: Direction.bottom },
      end: { tableId: 'B', x: 60, y: 500, direction: Direction.top },
    };

    const { m, l } = stubEnds(anchors, [0, 0]);

    expect(m).toEqual({ x: 60, y: 100 + PATH_END_HEIGHT });
    expect(l).toEqual({ x: 60, y: 500 - PATH_END_HEIGHT });
  });

  it('clamps both stubs when the two anchors face across a narrow gap', () => {
    const { m, l, startStub, endStub } = stubEnds(facing(90), [3, 3]);

    expect(startStub).toBe(44);
    expect(endStub).toBe(44);
    expect(m.x).toBeLessThan(l.x);
  });

  it('reads only what it is handed, never a channel', () => {
    const anchors = facing(400);

    expect(stubEnds(anchors, [2, 2])).toEqual(stubEnds({ ...anchors }, [2, 2]));
    expect(stubEnds(anchors, [2, 2]).startStub).not.toBe(
      stubEnds(anchors, [0, 0]).startStub
    );
  });
});
