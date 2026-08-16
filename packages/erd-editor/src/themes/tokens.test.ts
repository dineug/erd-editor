import { describe, expect, it } from 'vite-plus/test';

import { ThemeConfig } from '@/themes/radix-ui-theme.config';
import { type Theme, ThemeTokens, themeToTokensString } from '@/themes/tokens';

describe('ThemeTokens', () => {
  it('lists 65 tokens with no duplicates', () => {
    expect(ThemeTokens).toHaveLength(65);
    expect(new Set(ThemeTokens).size).toBe(ThemeTokens.length);
  });

  it('matches the keys of ThemeConfig exactly', () => {
    expect([...ThemeTokens].sort()).toEqual(Object.keys(ThemeConfig).sort());
  });

  it('keeps the palette scales in ascending order at the head of the list', () => {
    expect(ThemeTokens.slice(0, 12)).toEqual([
      'grayColor1',
      'grayColor2',
      'grayColor3',
      'grayColor4',
      'grayColor5',
      'grayColor6',
      'grayColor7',
      'grayColor8',
      'grayColor9',
      'grayColor10',
      'grayColor11',
      'grayColor12',
    ]);
    expect(ThemeTokens.slice(12, 24)).toEqual([
      'accentColor1',
      'accentColor2',
      'accentColor3',
      'accentColor4',
      'accentColor5',
      'accentColor6',
      'accentColor7',
      'accentColor8',
      'accentColor9',
      'accentColor10',
      'accentColor11',
      'accentColor12',
    ]);
  });

  it('ends with the diff tokens', () => {
    expect(ThemeTokens.slice(-6)).toEqual([
      'diffInsertBackground',
      'diffDeleteBackground',
      'diffCrossBackground',
      'diffInsertForeground',
      'diffDeleteForeground',
      'diffCrossForeground',
    ]);
  });

  it('spells the drag-select tokens correctly', () => {
    expect(ThemeTokens).toContain('dragSelectBackground');
    expect(ThemeTokens).toContain('dragSelectBorder');
    expect(ThemeTokens.filter(token => token.startsWith('darg'))).toEqual([]);
  });
});

describe('themeToTokensString', () => {
  it('emits one custom property per key, kebab-cased, with an erd-editor override fallback', () => {
    const theme = {
      canvasBackground: '#f0f0f0',
      tableBorder: '#d9d9d9',
    } as unknown as Theme;

    expect(themeToTokensString(theme)).toBe(
      [
        '--canvas-background: var(--erd-editor-canvas-background, #f0f0f0);',
        '--table-border: var(--erd-editor-table-border, #d9d9d9);',
      ].join('\n')
    );
  });

  it('emits the drag-select properties the stylesheet actually reads', () => {
    const theme = {
      dragSelectBackground: '#435db1',
      dragSelectBorder: '#3e63dd',
    } as unknown as Theme;

    expect(themeToTokensString(theme)).toBe(
      [
        '--drag-select-background: var(--erd-editor-drag-select-background, #435db1);',
        '--drag-select-border: var(--erd-editor-drag-select-border, #3e63dd);',
      ].join('\n')
    );
  });

  it('kebab-cases numeric suffixes and acronyms the same way lodash does', () => {
    const theme = {
      grayColor1: '#fcfcfc',
      grayColor10: '#838383',
      keyPK: '#ffc53d',
      keyPFK: '#00a2c7',
    } as unknown as Theme;

    expect(themeToTokensString(theme).split('\n')).toEqual([
      '--gray-color-1: var(--erd-editor-gray-color-1, #fcfcfc);',
      '--gray-color-10: var(--erd-editor-gray-color-10, #838383);',
      '--key-pk: var(--erd-editor-key-pk, #ffc53d);',
      '--key-pfk: var(--erd-editor-key-pfk, #00a2c7);',
    ]);
  });

  it('returns an empty string for an empty theme', () => {
    expect(themeToTokensString({} as unknown as Theme)).toBe('');
  });

  it('preserves insertion order and joins with a newline', () => {
    const theme = { b: '2', a: '1' } as unknown as Theme;
    expect(themeToTokensString(theme)).toBe(
      '--b: var(--erd-editor-b, 2);\n--a: var(--erd-editor-a, 1);'
    );
  });

  it('emits values verbatim, including non-hex and empty values', () => {
    const theme = {
      minimapBorder: 'black',
      scrollbarTrack: 'rgba(0, 0, 0, 0.06)',
      focus: '',
    } as unknown as Theme;

    expect(themeToTokensString(theme).split('\n')).toEqual([
      '--minimap-border: var(--erd-editor-minimap-border, black);',
      '--scrollbar-track: var(--erd-editor-scrollbar-track, rgba(0, 0, 0, 0.06));',
      '--focus: var(--erd-editor-focus, );',
    ]);
  });

  it('renders every ThemeToken when given a full theme-shaped object', () => {
    const theme = ThemeTokens.reduce(
      (acc, token) => Object.assign(acc, { [token]: '#000000' }),
      {}
    ) as Theme;

    const lines = themeToTokensString(theme).split('\n');
    expect(lines).toHaveLength(ThemeTokens.length);
    lines.forEach(line => {
      expect(line).toMatch(
        /^--[a-z0-9-]+: var\(--erd-editor-[a-z0-9-]+, #000000\);$/
      );
    });
  });
});
