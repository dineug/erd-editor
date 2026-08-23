import { describe, expect, it } from 'vite-plus/test';

import {
  CIRCLE_HEIGHT,
  CIRCLE_RADIUS,
  DirectionName,
  DirectionNameList,
  isDirection,
  LINE_HEIGHT,
  LINE_SIZE,
  MIN_STUB,
  PATH_END_HEIGHT,
  PATH_HEIGHT,
  PATH_LINE_HEIGHT,
} from '@/utils/draw-relationship';

describe('DirectionName', () => {
  it('maps every direction key to its own name', () => {
    expect(DirectionName).toEqual({
      left: 'left',
      right: 'right',
      top: 'top',
      bottom: 'bottom',
    });
  });

  it('lists the direction names in declaration order', () => {
    expect(DirectionNameList).toEqual(['left', 'right', 'top', 'bottom']);
  });
});

describe('isDirection', () => {
  it('accepts every direction name', () => {
    expect(DirectionNameList.every(isDirection)).toBe(true);
  });

  it.each(['left', 'right', 'top', 'bottom'])('accepts %s', name => {
    expect(isDirection(name)).toBe(true);
  });

  it.each(['lt', 'rb', 'center', 'LEFT', '', 'width'])('rejects %j', name => {
    expect(isDirection(name)).toBe(false);
  });

  it('rejects the corner point keys that share the ObjectPoint shape', () => {
    expect(['lt', 'rt', 'lb', 'rb'].some(isDirection)).toBe(false);
  });
});

describe('layout constants', () => {
  it('derives the path end height from the path height', () => {
    expect(PATH_HEIGHT).toBe(30);
    expect(PATH_END_HEIGHT).toBe(PATH_HEIGHT + 20);
    expect(PATH_END_HEIGHT).toBe(50);
  });

  it('exposes the line drawing metrics', () => {
    expect(PATH_LINE_HEIGHT).toBe(25);
    expect(LINE_SIZE).toBe(7);
    expect(LINE_HEIGHT).toBe(11);
    expect(CIRCLE_HEIGHT).toBe(18);
    expect(CIRCLE_RADIUS).toBe(6);
  });

  it('centres the ring on the second tick', () => {
    expect(CIRCLE_HEIGHT).toBe(LINE_SIZE + LINE_HEIGHT);
  });

  it('starts the guide line where the longest decoration stroke ends', () => {
    expect(PATH_LINE_HEIGHT).toBe(LINE_HEIGHT + LINE_HEIGHT + 3);
  });

  it('leaves the ring clear of the tick behind it and the guide line ahead', () => {
    expect(CIRCLE_HEIGHT - CIRCLE_RADIUS).toBeGreaterThan(LINE_HEIGHT);
    expect(CIRCLE_HEIGHT + CIRCLE_RADIUS).toBeLessThan(PATH_LINE_HEIGHT);
  });

  it('keeps the path line stub shorter than the path end', () => {
    expect(PATH_LINE_HEIGHT).toBeLessThan(PATH_END_HEIGHT);
  });

  it('clamps a stub clear of the decorations without following them down', () => {
    expect(MIN_STUB).toBe(36);
    // The guide line runs from the decorations out to the stub, so a stub
    // inside them draws it backwards.
    expect(MIN_STUB).toBeGreaterThan(PATH_LINE_HEIGHT);
  });
});
