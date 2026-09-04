// The scroll a memo body keeps between the scene and the editor over it. What
// the fold overruns the box by is the whole of its travel, and the store holds
// a scroll the body may since have outgrown, so every read is clamped.

import { describe, expect, it } from 'vite-plus/test';

import {
  clampMemoScrollTop,
  getMemoScrollMax,
  getMemoScrollTop,
} from '@/components/erd/canvas/memo/memoScroll';
import {
  getMemoLineHeightPx,
  layoutMemoLines,
} from '@/components/erd/canvas/memo/memoText';
import { createEditor } from '@/engine/modules/editor/state';
import { createMemo } from '@/utils/collection/memo.entity';

/** Written out because a comment cannot show the character it names. */
const LINE_BREAK = String.fromCharCode(10);

const WIDTH = 200;
const HEIGHT = 150;

const memoOf = (value: string, height = HEIGHT) =>
  createMemo({
    id: 'note',
    value,
    ui: { x: 0, y: 0, zIndex: 1, width: WIDTH, height, color: '#ffffff' },
  });

const brokenLines = (count: number) =>
  Array.from({ length: count }, (_, line) => `line ${line}`).join(LINE_BREAK);

const overrunOf = (value: string, height = HEIGHT) =>
  layoutMemoLines(value, WIDTH).length * getMemoLineHeightPx() - height;

describe('the travel a memo body has', () => {
  it('is nothing while the fold fits the box', () => {
    expect(getMemoScrollMax(memoOf('hello memo'))).toBe(0);
    expect(getMemoScrollMax(memoOf(''))).toBe(0);
  });

  it('is what the lines the author broke overrun the box by', () => {
    const value = brokenLines(30);

    expect(layoutMemoLines(value, WIDTH)).toHaveLength(30);
    expect(getMemoScrollMax(memoOf(value))).toBeCloseTo(overrunOf(value), 6);
  });

  it('counts the lines the box folded, not only the ones the author broke', () => {
    const value = Array.from({ length: 40 }, () => 'the quick brown fox').join(
      ' '
    );

    expect(layoutMemoLines(value, WIDTH).length).toBeGreaterThan(1);
    expect(getMemoScrollMax(memoOf(value))).toBeCloseTo(overrunOf(value), 6);
  });

  it('shrinks as the box grows and is gone once the box holds the body', () => {
    const value = brokenLines(30);
    const tall = getMemoScrollMax(memoOf(value, 100));
    const short = getMemoScrollMax(memoOf(value, 300));

    expect(short).toBeLessThan(tall);
    expect(getMemoScrollMax(memoOf(value, 10_000))).toBe(0);
  });
});

describe('the clamp every read of a memo scroll goes through', () => {
  it('holds a scroll between the first line and the last the box can start on', () => {
    const memo = memoOf(brokenLines(30));
    const max = getMemoScrollMax(memo);

    expect(max).toBeGreaterThan(40);
    expect(clampMemoScrollTop(memo, -10)).toBe(0);
    expect(clampMemoScrollTop(memo, 40)).toBe(40);
    expect(clampMemoScrollTop(memo, max)).toBe(max);
    expect(clampMemoScrollTop(memo, max + 500)).toBe(max);
  });

  it('reads a memo nothing has scrolled as starting on its first line', () => {
    expect(getMemoScrollTop(createEditor(), memoOf(brokenLines(30)))).toBe(0);
  });

  it('reads the stored scroll back, clamped to the body the memo has now', () => {
    const editor = createEditor();
    const tall = memoOf(brokenLines(30));
    editor.memoScrollTopMap[tall.id] = 40;
    expect(getMemoScrollTop(editor, tall)).toBe(40);

    const shorter = { ...tall, value: brokenLines(12) };
    expect(getMemoScrollMax(shorter)).toBeLessThan(40);
    expect(getMemoScrollTop(editor, shorter)).toBe(getMemoScrollMax(shorter));

    const fits = { ...tall, value: 'hello memo' };
    expect(getMemoScrollTop(editor, fits)).toBe(0);
  });

  it('reads one memo scroll without touching another', () => {
    const editor = createEditor();
    const memo = memoOf(brokenLines(30));
    editor.memoScrollTopMap.other = 40;

    expect(getMemoScrollTop(editor, memo)).toBe(0);
  });
});
