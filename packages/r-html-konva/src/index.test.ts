import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import * as batchDraw from '@/batchDraw';
import * as host from '@/host';
import type { KonvaIntrinsicElements } from '@/index';
import * as entry from '@/index';

describe('the package entry', () => {
  it('exposes the host and the draw gate, and nothing else', () => {
    expect(Object.keys(entry).sort()).toEqual(
      [
        'MINIMAP_STAGE_NAME',
        'beginAnimation',
        'currentEpoch',
        'endAnimation',
        'hostStats',
        'konva',
        'konvaAdapter',
        'markDirty',
        'onBeforeFlush',
        'renderKonva',
        'requestFlush',
        'resetHostStats',
        'whenDrawn',
      ].sort()
    );
  });

  it('re-exports the modules a scene would otherwise reach into', () => {
    expect(entry.konva).toBe(host.konva);
    expect(entry.konvaAdapter).toBe(host.konvaAdapter);
    expect(entry.renderKonva).toBe(host.renderKonva);
    expect(entry.markDirty).toBe(batchDraw.markDirty);
    expect(entry.whenDrawn).toBe(batchDraw.whenDrawn);
  });

  it('names the intrinsics a consumer program merges into its JSX', () => {
    expectTypeOf<keyof KonvaIntrinsicElements>().toEqualTypeOf<
      | 'k-circle'
      | 'k-group'
      | 'k-layer'
      | 'k-line'
      | 'k-path'
      | 'k-rect'
      | 'k-shape'
      | 'k-text'
    >();
  });
});
