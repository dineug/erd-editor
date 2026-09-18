// The leading a realm with no usable document falls back to, and the point
// where the fold cache lets go of what it holds. Both need a fresh module
// per case, since memoLineHeightPx and the fold cache are held at module scope.

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { SCENE_FONT_SIZE } from '@/components/erd/canvas/sceneTokens';

const FALLBACK_LINE_HEIGHT_PX = SCENE_FONT_SIZE * 1.2;

// happy-dom carries no real canvas or OffscreenCanvas measurement, which
// pretext needs for its own font metrics. The cache test below cares about
// memoText's own Map, so it stands a trivial fold in for a path this realm cannot run.
vi.mock('@chenglou/pretext', () => ({
  prepareWithSegments: (value: string) => value,
  layoutWithLines: (prepared: string) => ({ lines: [{ text: prepared }] }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function freshMemoText() {
  vi.resetModules();
  return await import('@/components/erd/canvas/memo/memoText');
}

describe('the leading a memo body falls back to', () => {
  it('answers the default leading in a realm with no document global', async () => {
    vi.stubGlobal('document', undefined);

    const { getMemoLineHeightPx } = await freshMemoText();

    expect(getMemoLineHeightPx()).toBe(FALLBACK_LINE_HEIGHT_PX);
  });

  it('answers the default leading when the document carries no body yet', async () => {
    vi.stubGlobal('document', {});

    const { getMemoLineHeightPx } = await freshMemoText();

    expect(getMemoLineHeightPx()).toBe(FALLBACK_LINE_HEIGHT_PX);
  });

  it('answers the default leading when the probe measures no layout at all', async () => {
    // happy-dom lays nothing out, so getBoundingClientRect answers a zero rect
    // here the way a hidden or disconnected element would in a real browser.
    const { getMemoLineHeightPx } = await freshMemoText();

    expect(getMemoLineHeightPx()).toBe(FALLBACK_LINE_HEIGHT_PX);
  });
});

describe('the fold cache a memo body is laid out through', () => {
  it('clears itself once it holds the limit, so an older fold is laid out again', async () => {
    const { layoutMemoLines } = await freshMemoText();
    const width = 200;

    const first = layoutMemoLines('line 0', width);

    // One short of the limit the module clears at: the next distinct key is
    // what tips the cache over and triggers the clear before it is stored.
    for (let i = 1; i < 256; i++) {
      layoutMemoLines(`line ${i}`, width);
    }
    layoutMemoLines('line 256', width);

    // The clear drops every earlier fold, so asking for the first key again
    // lays it out fresh rather than handing back the same cached array.
    const recomputed = layoutMemoLines('line 0', width);

    expect(recomputed).not.toBe(first);
    expect(recomputed).toEqual(first);
  });
});
