import { describe, expect, it } from 'vite-plus/test';

import { pseudoMessages } from '@/__test-utils__/index';
import { ColumnTypeToMessageKey } from '@/components/settings/columnTypeLabels';
import { ColumnType, ColumnTypeList } from '@/constants/schema';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';

describe('ColumnTypeToMessageKey', () => {
  it('names every column type flag in English as the settings list always has', () => {
    const names = Object.fromEntries(
      Object.entries(ColumnTypeToMessageKey).map(([columnType, key]) => [
        columnType,
        sourceI18n.t(key),
      ])
    );

    expect(names).toEqual({
      [ColumnType.columnName]: 'Name',
      [ColumnType.columnDataType]: 'DataType',
      [ColumnType.columnNotNull]: 'Not Null',
      [ColumnType.columnUnique]: 'Unique',
      [ColumnType.columnAutoIncrement]: 'Auto Increment',
      [ColumnType.columnDefault]: 'Default',
      [ColumnType.columnComment]: 'Comment',
    });
  });

  it('covers every entry of ColumnTypeList with a key of its own', () => {
    const keys = ColumnTypeList.map(columnType => {
      const key = ColumnTypeToMessageKey[columnType];
      expect(key).toMatch(/^common\.column\./);
      return key;
    });

    expect(new Set(keys).size).toBe(ColumnTypeList.length);
    expect(Object.keys(ColumnTypeToMessageKey)).toHaveLength(
      ColumnTypeList.length
    );
  });

  it('reads each name in the language given', () => {
    const i18n = createI18n('ko-KR', pseudoMessages('ko'));

    expect(i18n.t(ColumnTypeToMessageKey[ColumnType.columnNotNull])).toBe(
      'ko:Not Null'
    );
  });

  it('returns undefined for a flag that is not a column type', () => {
    expect(ColumnTypeToMessageKey[0]).toBeUndefined();
    expect(
      ColumnTypeToMessageKey[ColumnType.columnName | ColumnType.columnUnique]
    ).toBeUndefined();
  });
});
