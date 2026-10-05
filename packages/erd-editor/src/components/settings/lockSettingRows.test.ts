import { describe, expect, it } from 'vite-plus/test';

import { lockSettingRows } from '@/components/settings/lockSettingRows';
import {
  BracketType,
  CanvasType,
  Language,
  LockSettingTypeList,
  NameCase,
} from '@/constants/schema';
import { RootState } from '@/engine/state';

const values: RootState['settings']['lockedValues'] = {
  originX: -40.4,
  originY: 90.6,
  zoomLevel: 0.75,
  canvasType: CanvasType.visualization,
  language: Language.csharp,
  tableNameCase: NameCase.snakeCase,
  columnNameCase: NameCase.none,
  bracketType: BracketType.singleQuote,
};

const textOf = (name: string, held = values) =>
  lockSettingRows.find(row => row.name === name)!.toText(held);

describe('lockSettingRows', () => {
  it('holds one row per lock, in the order of the bits', () => {
    expect(lockSettingRows.map(row => row.lockSettingType)).toEqual(
      LockSettingTypeList
    );
  });

  it('names each value by the name the menu that sets it gives', () => {
    expect(lockSettingRows.map(row => row.toText(values))).toEqual([
      '75% · -40, 91',
      'Visualization',
      'C#',
      'Snake',
      'None',
      'SingleQuote',
    ]);
  });

  it.each([
    [{ originX: 12_345, originY: -2_400 }, '75% · 12k, -2.4k'],
    [{ originX: -4_250_000, originY: 999.6 }, '75% · -4.3M, 1.0k'],
    [{ originX: -0.4, originY: 0.4 }, '75% · 0, 0'],
  ])(
    'shortens a far origin with the unit the compass prints',
    (origin, text) => {
      expect(textOf('Viewport', { ...values, ...origin })).toBe(text);
    }
  );

  it.each([
    [CanvasType.ERD, 'ERD'],
    [CanvasType.schemaSQL, 'Schema SQL'],
    [CanvasType.generatorCode, 'Code Generator'],
    [CanvasType.settings, 'Settings'],
  ])('names the tab %s as the toolbar does', (canvasType, name) => {
    expect(textOf('Canvas Type', { ...values, canvasType })).toBe(name);
  });

  it('shows a value no menu names as it is stored', () => {
    const unknown = {
      ...values,
      canvasType: 'plugin-canvas',
      language: 3,
      tableNameCase: 3,
      columnNameCase: 3,
      bracketType: 3,
    };

    expect(textOf('Canvas Type', unknown)).toBe('plugin-canvas');
    expect(textOf('Language', unknown)).toBe('3');
    expect(textOf('Table Name Case', unknown)).toBe('3');
    expect(textOf('Column Name Case', unknown)).toBe('3');
    expect(textOf('Bracket Type', unknown)).toBe('3');
  });
});
