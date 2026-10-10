import { describe, expect, it } from 'vite-plus/test';

import { createTableGroup } from '@/utils/collection/tableGroup.entity';

describe('createTableGroup', () => {
  it('creates a group with no name, no color and the schema factory rectangle', () => {
    const group = createTableGroup();

    expect(group.name).toBe('');
    expect(group.color).toBe('');
    expect(group.ui).toEqual({
      x: 200,
      y: 100,
      width: 400,
      height: 300,
      zIndex: 1,
    });
    expect(group).not.toHaveProperty('meta');
    expect(group.id.length).toBeGreaterThan(0);
  });

  it('keeps every field it is given over the defaults', () => {
    const group = createTableGroup({
      id: 'g1',
      name: 'billing',
      color: '#0090ff',
      ui: { x: -40, width: 640 },
    });

    expect(group).toMatchObject({
      id: 'g1',
      name: 'billing',
      color: '#0090ff',
      ui: { x: -40, y: 100, width: 640, height: 300, zIndex: 1 },
    });
  });

  it('mints a new id per call', () => {
    expect(createTableGroup().id).not.toBe(createTableGroup().id);
  });
});
