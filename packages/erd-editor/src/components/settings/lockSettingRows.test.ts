import { describe, expect, it } from 'vite-plus/test';

import { pseudoMessages } from '@/__test-utils__/index';
import { lockSettingRows } from '@/components/settings/lockSettingRows';
import {
  BracketType,
  CanvasType,
  Language,
  LockSettingType,
  LockSettingTypeList,
  NameCase,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';

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

const pseudo = createI18n('ko-KR', pseudoMessages('ko'));

const rowOf = (lockSettingType: number) =>
  lockSettingRows.find(row => row.lockSettingType === lockSettingType)!;

const textOf = (lockSettingType: number, held = values, i18n = sourceI18n) =>
  rowOf(lockSettingType).toText(held, i18n);

describe('lockSettingRows', () => {
  it('holds one row per lock, in the order of the bits', () => {
    expect(lockSettingRows.map(row => row.lockSettingType)).toEqual(
      LockSettingTypeList
    );
  });

  it('names each row in English as the Settings tab always has', () => {
    expect(lockSettingRows.map(row => sourceI18n.t(row.nameKey))).toEqual([
      'Viewport',
      'Canvas Type',
      'Language',
      'Table Name Case',
      'Column Name Case',
      'Bracket Type',
    ]);
  });

  it('names each row in the language given', () => {
    expect(lockSettingRows.map(row => pseudo.t(row.nameKey))).toEqual([
      'ko:Viewport',
      'ko:Canvas Type',
      'ko:Language',
      'ko:Table Name Case',
      'ko:Column Name Case',
      'ko:Bracket Type',
    ]);
  });

  it('names each value by the name the menu that sets it gives', () => {
    expect(lockSettingRows.map(row => row.toText(values, sourceI18n))).toEqual([
      '75% · -40, 91',
      'Visualization',
      'C#',
      'Snake',
      'None',
      'SingleQuote',
    ]);
  });

  it('translates the tab and None, and keeps codes, cases and quotes as written', () => {
    expect(lockSettingRows.map(row => row.toText(values, pseudo))).toEqual([
      '75% · -40, 91',
      'ko:Visualization',
      'C#',
      'Snake',
      'ko:None',
      'SingleQuote',
    ]);
    expect(
      textOf(
        LockSettingType.bracketType,
        { ...values, bracketType: BracketType.none },
        pseudo
      )
    ).toBe('ko:None');
  });

  it.each([
    [{ originX: 12_345, originY: -2_400 }, '75% · 12k, -2.4k'],
    [{ originX: -4_250_000, originY: 999.6 }, '75% · -4.3M, 1.0k'],
    [{ originX: -0.4, originY: 0.4 }, '75% · 0, 0'],
  ])(
    'shortens a far origin with the unit the compass prints',
    (origin, text) => {
      expect(textOf(LockSettingType.viewport, { ...values, ...origin })).toBe(
        text
      );
    }
  );

  it.each([
    [CanvasType.ERD, 'ERD'],
    [CanvasType.schemaSQL, 'Schema SQL'],
    [CanvasType.generatorCode, 'Code Generator'],
    [CanvasType.settings, 'Settings'],
  ])('names the tab %s as the toolbar does', (canvasType, name) => {
    expect(textOf(LockSettingType.canvasType, { ...values, canvasType })).toBe(
      name
    );
  });

  it('keeps ERD as written in every language', () => {
    expect(
      textOf(
        LockSettingType.canvasType,
        { ...values, canvasType: CanvasType.ERD },
        pseudo
      )
    ).toBe('ERD');
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

    expect(textOf(LockSettingType.canvasType, unknown)).toBe('plugin-canvas');
    expect(textOf(LockSettingType.language, unknown)).toBe('3');
    expect(textOf(LockSettingType.tableNameCase, unknown)).toBe('3');
    expect(textOf(LockSettingType.columnNameCase, unknown)).toBe('3');
    expect(textOf(LockSettingType.bracketType, unknown)).toBe('3');
  });
});
