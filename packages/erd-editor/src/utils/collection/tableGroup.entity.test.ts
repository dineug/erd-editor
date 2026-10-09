import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTableGroup } from '@/utils/collection/tableGroup.entity';

describe('createTableGroup', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a group with no name, no color and the schema factory rectangle', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T03:04:05.000Z'));
    const now = Date.now();

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
    expect(group.meta).toEqual({ updateAt: now, createAt: now });
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
