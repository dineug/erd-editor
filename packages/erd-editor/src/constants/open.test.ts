import { describe, expect, it } from 'vite-plus/test';

import { Open } from '@/constants/open';

describe('Open', () => {
  it('lists every overlay that the editor can toggle', () => {
    expect(Open).toEqual({
      automaticTablePlacement: 'automaticTablePlacement',
      tableProperties: 'tableProperties',
      search: 'search',
      themeBuilder: 'themeBuilder',
      diffViewer: 'diffViewer',
      timeTravel: 'timeTravel',
    });
  });

  it('uses the key as its own value so it can index editor.openMap', () => {
    for (const [key, value] of Object.entries(Open)) {
      expect(value).toBe(key);
      expect(typeof value).toBe('string');
    }
  });

  it('keeps the declaration order used by the toolbar', () => {
    expect(Object.values(Open)).toEqual([
      'automaticTablePlacement',
      'tableProperties',
      'search',
      'themeBuilder',
      'diffViewer',
      'timeTravel',
    ]);
  });

  it('has no duplicate values', () => {
    const values = Object.values(Open);
    expect(new Set(values).size).toBe(values.length);
  });

  it('works as a Record<string, boolean> key set', () => {
    const openMap: Record<string, boolean> = {};
    openMap[Open.themeBuilder] = true;

    expect(openMap[Open.themeBuilder]).toBe(true);
    expect(openMap[Open.diffViewer]).toBeUndefined();
  });
});
