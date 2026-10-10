import { describe, expect, it } from 'vite-plus/test';

import * as tableGroupEntityModule from '@/v3/schema/tableGroup.entity';
import { TableGroup, TableGroupUI } from '@/v3/schema/tableGroup.entity';

describe('v3/schema/tableGroup.entity', () => {
  it('is a type-only module with no runtime exports', () => {
    expect(Object.keys(tableGroupEntityModule)).toEqual([]);
  });

  it('describes a fully populated table group entity', () => {
    const ui: TableGroupUI = {
      x: -120,
      y: 40,
      width: 640,
      height: 360,
      zIndex: 3,
    };
    const group: TableGroup = {
      id: 'group-1',
      name: 'billing',
      color: '#0090ff',
      ui,
    };

    expect(group.name).toBe('billing');
    expect(group.color).toBe('#0090ff');
    expect(Object.keys(group.ui).sort()).toEqual([
      'height',
      'width',
      'x',
      'y',
      'zIndex',
    ]);
  });

  it('keeps its colour beside the name, not in the ui', () => {
    const group: TableGroup = {
      id: 'group-2',
      name: '',
      color: '',
      ui: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
    };

    expect(Object.keys(group).sort()).toEqual(['color', 'id', 'name', 'ui']);
    expect(group.ui).not.toHaveProperty('color');
  });
});
