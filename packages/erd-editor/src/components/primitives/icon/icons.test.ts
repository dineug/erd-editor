import { describe, expect, it } from 'vite-plus/test';

import {
  BASE_64_ICON,
  getIcon,
  IconDefinition,
  iconMap,
} from '@/components/primitives/icon/icons';

describe('icons', () => {
  it('keys the icon map by `${prefix}-${iconName}`', () => {
    const entries = Object.entries(iconMap);

    expect(entries.length).toBeGreaterThan(0);
    for (const [key, icon] of entries) {
      expect(key).toBe(`${icon.prefix}-${icon.iconName}`);
    }
  });

  it('registers the font-awesome solid icons under the `fas` prefix', () => {
    const icon = getIcon('fas', 'key') as IconDefinition;

    expect(icon).toBeTruthy();
    expect(icon.prefix).toBe('fas');
    expect(icon.iconName).toBe('key');
    expect(typeof icon.icon[0]).toBe('number');
    expect(typeof icon.icon[1]).toBe('number');
    expect(typeof icon.icon[4]).toBe('string');
    expect(icon.icon[4].length).toBeGreaterThan(0);
  });

  it('registers the font-awesome regular copy icon under the `far` prefix', () => {
    const icon = getIcon('far', 'copy') as IconDefinition;

    expect(icon).toBeTruthy();
    expect(icon.prefix).toBe('far');
    expect(icon.iconName).toBe('copy');
  });

  it('normalizes every mdi icon to a 24x24 viewBox', () => {
    const mdiIcons = Object.values(iconMap).filter(
      icon => icon.prefix === 'mdi'
    );

    expect(mdiIcons.length).toBeGreaterThan(0);
    for (const icon of mdiIcons) {
      expect(icon.icon[0]).toBe(24);
      expect(icon.icon[1]).toBe(24);
      expect(icon.icon[2]).toBeUndefined();
      expect(icon.icon[3]).toBeUndefined();
      expect(typeof icon.icon[4]).toBe('string');
    }

    expect(getIcon('mdi', 'database')).toBeTruthy();
    expect(getIcon('mdi', 'code-json')).toBeTruthy();
  });

  it('normalizes the radix timer icon to a 15x15 viewBox', () => {
    const icon = getIcon('radix', 'timer') as IconDefinition;

    expect(icon).toBeTruthy();
    expect(icon.icon[0]).toBe(15);
    expect(icon.icon[1]).toBe(15);
    expect(icon.icon[4].startsWith('M7.49998 0.849976')).toBe(true);
  });

  it('registers one base64 icon per BASE_64_ICON entry with the data uri as its path data', () => {
    const names = Object.keys(BASE_64_ICON);

    expect(names).toEqual([
      'ZeroOneN',
      'ZeroOne',
      'ZeroN',
      'OneOnly',
      'OneN',
      'One',
      'N',
    ]);

    for (const name of names) {
      const icon = getIcon('base64', name) as IconDefinition;
      expect(icon).toBeTruthy();
      expect(icon.icon[0]).toBe(24);
      expect(icon.icon[1]).toBe(24);
      expect(icon.icon[4]).toBe(
        BASE_64_ICON[name as keyof typeof BASE_64_ICON]
      );
      expect(icon.icon[4].startsWith('data:image/png;base64,')).toBe(true);
    }
  });

  it('returns undefined for an unknown prefix or icon name', () => {
    expect(getIcon('fas', 'nope')).toBeUndefined();
    expect(getIcon('nope', 'key')).toBeUndefined();
    expect(getIcon('', '')).toBeUndefined();
  });

  it('returns the identical object stored in the map', () => {
    expect(getIcon('mdi', 'atom')).toBe(iconMap['mdi-atom']);
  });
});
