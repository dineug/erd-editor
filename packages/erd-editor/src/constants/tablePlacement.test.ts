import { describe, expect, it } from 'vite-plus/test';

import {
  DEFAULT_TABLE_PLACEMENT,
  TablePlacement,
} from '@/constants/tablePlacement';

describe('TablePlacement', () => {
  it('lists every placement the editor can be asked for', () => {
    expect(TablePlacement).toEqual({
      force: 'force',
      layeredHorizontal: 'layeredHorizontal',
      layeredVertical: 'layeredVertical',
      flow: 'flow',
    });
  });

  it('uses the key as its own value, so one travels as itself', () => {
    for (const [key, value] of Object.entries(TablePlacement)) {
      expect(value).toBe(key);
    }
  });

  it('opens on the simulation the editor has always run', () => {
    expect(DEFAULT_TABLE_PLACEMENT).toBe(TablePlacement.force);
  });
});
