import { get } from 'lodash-es';
import { describe, expect, it } from 'vite-plus/test';

import { Palette } from '@/themes/radix-ui-theme';
import { ThemeConfig } from '@/themes/radix-ui-theme.config';
import { ThemeTokens } from '@/themes/tokens';

const entries = Object.entries(ThemeConfig);

describe('ThemeConfig', () => {
  it('declares exactly one mapping per theme token', () => {
    expect(Object.keys(ThemeConfig).sort()).toEqual([...ThemeTokens].sort());
    expect(entries).toHaveLength(65);
  });

  it('maps every gray/accent scale token onto its own scale step', () => {
    for (let step = 1; step <= 12; step++) {
      expect(get(ThemeConfig, `grayColor${step}`)).toBe(`gray-${step}`);
      expect(get(ThemeConfig, `accentColor${step}`)).toBe(`accent-${step}`);
    }
  });

  it('uses only the gray, grayA, accent, override and custom prefixes', () => {
    const types = new Set(entries.map(([, value]) => value.split('-')[0]));
    expect([...types].sort()).toEqual([
      'accent',
      'custom',
      'gray',
      'grayA',
      'override',
    ]);
  });

  it('keeps every gray/grayA/accent reference inside the 1..12 radix scale', () => {
    const scaled = entries.filter(([, value]) =>
      /^(gray|grayA|accent)-/.test(value)
    );
    expect(scaled.length).toBeGreaterThan(0);

    scaled.forEach(([key, value]) => {
      const [, step] = value.split('-');
      const stepNumber = Number(step);
      expect(
        Number.isInteger(stepNumber),
        `${key} -> ${value} is not an integer step`
      ).toBe(true);
      expect(stepNumber).toBeGreaterThanOrEqual(1);
      expect(stepNumber).toBeLessThanOrEqual(12);
    });
  });

  it('resolves every custom reference against a real radix palette in both appearances', () => {
    const customs = entries.filter(([, value]) => value.startsWith('custom-'));
    expect(customs.map(([key]) => key)).toEqual([
      'keyPK',
      'keyFK',
      'keyPFK',
      'diffInsertBackground',
      'diffDeleteBackground',
      'diffCrossBackground',
      'diffInsertForeground',
      'diffDeleteForeground',
      'diffCrossForeground',
    ]);

    customs.forEach(([key, value]) => {
      const [, color, alpha, step] = value.split('-');
      // the double dash means "no alpha variant"
      expect(alpha, `${key} -> ${value}`).toBe('');
      expect(get(Palette, `${color}.${color}${step}`)).toMatch(/^#[0-9a-f]+$/);
      expect(get(Palette, `${color}Dark.${color}${step}`)).toMatch(
        /^#[0-9a-f]+$/
      );
    });
  });

  it('only overrides with the literal black color', () => {
    const overrides = entries.filter(([, value]) =>
      value.startsWith('override-')
    );
    expect(overrides).toEqual([
      ['minimapBorder', 'override-black'],
      ['minimapShadow', 'override-black'],
    ]);
  });

  it('wires the surface tokens to the documented radix steps', () => {
    expect(ThemeConfig.canvasBackground).toBe('gray-3');
    expect(ThemeConfig.canvasBoundaryBackground).toBe('gray-1');
    expect(ThemeConfig.tableBackground).toBe('gray-2');
    expect(ThemeConfig.tableSelect).toBe('accent-8');
    expect(ThemeConfig.tableBorder).toBe('gray-6');
    expect(ThemeConfig.foreground).toBe('gray-11');
    expect(ThemeConfig.active).toBe('gray-12');
    expect(ThemeConfig.focus).toBe('accent-8');
    expect(ThemeConfig.inputActive).toBe('accent-10');
  });

  it('uses the alpha gray scale for the scrollbar track and the placeholder', () => {
    expect(ThemeConfig.scrollbarTrack).toBe('grayA-3');
    expect(ThemeConfig.placeholder).toBe('grayA-10');
    expect(ThemeConfig.scrollbarThumb).toBe('gray-9');
    expect(ThemeConfig.scrollbarThumbHover).toBe('gray-10');
  });

  it('gives memo and table the same background/border/select treatment', () => {
    expect(ThemeConfig.memoBackground).toBe(ThemeConfig.tableBackground);
    expect(ThemeConfig.memoBorder).toBe(ThemeConfig.tableBorder);
    expect(ThemeConfig.memoSelect).toBe(ThemeConfig.tableSelect);
  });

  it('assigns a distinct key color to each of PK, FK and PFK', () => {
    expect(ThemeConfig.keyPK).toBe('custom-amber--9');
    expect(ThemeConfig.keyFK).toBe('custom-ruby--9');
    expect(ThemeConfig.keyPFK).toBe('custom-cyan--9');
    expect(
      new Set([ThemeConfig.keyPK, ThemeConfig.keyFK, ThemeConfig.keyPFK]).size
    ).toBe(3);
  });

  it('pairs each diff background at step 4 with a foreground at step 11', () => {
    expect(ThemeConfig.diffInsertBackground).toBe('custom-green--4');
    expect(ThemeConfig.diffDeleteBackground).toBe('custom-red--4');
    expect(ThemeConfig.diffCrossBackground).toBe('custom-blue--4');
    expect(ThemeConfig.diffInsertForeground).toBe('custom-green--11');
    expect(ThemeConfig.diffDeleteForeground).toBe('custom-red--11');
    expect(ThemeConfig.diffCrossForeground).toBe('custom-blue--11');
  });
});
