import { describe, expect, it } from 'vite-plus/test';

import {
  CIRCLE_HEIGHT,
  DirectionName,
  DirectionNameList,
  isDirection,
  LINE_HEIGHT,
  LINE_SIZE,
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
    expect(PATH_LINE_HEIGHT).toBe(35);
    expect(LINE_SIZE).toBe(10);
    expect(LINE_HEIGHT).toBe(16);
    expect(CIRCLE_HEIGHT).toBe(26);
  });

  it('keeps the path line stub shorter than the path end', () => {
    expect(PATH_LINE_HEIGHT).toBeLessThan(PATH_END_HEIGHT);
  });
});
