import { describe, expect, it } from 'vite-plus/test';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import {
  BracketType,
  CanvasType,
  ColumnType,
  Database,
  Language,
  NameCase,
} from '@/constants/schema';
import { DatabaseVendor } from '@/constants/sql/database';
import {
  canvasSizeInRange,
  hasBracketType,
  hasCanvasType,
  hasColumnType,
  hasDatabase,
  hasDatabaseVendor,
  hasLanguage,
  hasNameCase,
  isEditableTarget,
  isHighLevelTable,
  maxWidthCommentInRange,
  textInRange,
  toMaxWidthCommentFormat,
  toNumString,
  toSafeString,
  toZoomFormat,
  zoomLevelInRange,
} from '@/utils/validation';

describe('toNumString', () => {
  it('strips every non digit character', () => {
    expect(toNumString('a1b2c3')).toBe('123');
    expect(toNumString('1,234.56')).toBe('123456');
    expect(toNumString('-42')).toBe('42');
  });

  it('returns an empty string when there is no digit', () => {
    expect(toNumString('')).toBe('');
    expect(toNumString('abc')).toBe('');
  });

  it('keeps a pure numeric string untouched', () => {
    expect(toNumString('2000')).toBe('2000');
  });
});

describe('canvasSizeInRange', () => {
  it('clamps numbers to [2000, 20000]', () => {
    expect(canvasSizeInRange(0)).toBe(2000);
    expect(canvasSizeInRange(1999)).toBe(2000);
    expect(canvasSizeInRange(2000)).toBe(2000);
    expect(canvasSizeInRange(5000)).toBe(5000);
    expect(canvasSizeInRange(20000)).toBe(20000);
    expect(canvasSizeInRange(99999)).toBe(20000);
  });

  it('parses strings by keeping the digits only', () => {
    expect(canvasSizeInRange('3000')).toBe(3000);
    expect(canvasSizeInRange('3000px')).toBe(3000);
    expect(canvasSizeInRange('1,0000')).toBe(10000);
  });

  it('treats a digit-less string as 0 and clamps it to the minimum', () => {
    expect(canvasSizeInRange('')).toBe(2000);
    expect(canvasSizeInRange('abc')).toBe(2000);
  });
});

describe('zoomLevelInRange', () => {
  it('clamps to [0.1, 1.5]', () => {
    expect(zoomLevelInRange(0)).toBe(0.1);
    expect(zoomLevelInRange(-3)).toBe(0.1);
    expect(zoomLevelInRange(1)).toBe(1);
    expect(zoomLevelInRange(1.5)).toBe(1.5);
    expect(zoomLevelInRange(4)).toBe(1.5);
  });

  it('passes a magnified zoom through untouched', () => {
    expect(zoomLevelInRange(1.04)).toBe(1.04);
    expect(zoomLevelInRange(1.2)).toBe(1.2);
    expect(zoomLevelInRange(1.49)).toBe(1.49);
  });

  it('rounds to 2 decimals', () => {
    expect(zoomLevelInRange(0.456)).toBe(0.46);
    expect(zoomLevelInRange(0.333333)).toBe(0.33);
    expect(zoomLevelInRange(0.5)).toBe(0.5);
  });
});

describe('maxWidthCommentInRange', () => {
  it('clamps to [COLUMN_MIN_WIDTH, 200]', () => {
    expect(maxWidthCommentInRange(0)).toBe(COLUMN_MIN_WIDTH);
    expect(maxWidthCommentInRange(120)).toBe(120);
    expect(maxWidthCommentInRange(500)).toBe(200);
  });
});

describe('toMaxWidthCommentFormat', () => {
  it('appends px to the clamped width', () => {
    expect(toMaxWidthCommentFormat(120)).toBe('120px');
    expect(toMaxWidthCommentFormat(10)).toBe(`${COLUMN_MIN_WIDTH}px`);
    expect(toMaxWidthCommentFormat(1000)).toBe('200px');
  });

  it('accepts numeric strings even though the signature says number', () => {
    expect(toMaxWidthCommentFormat('120' as any)).toBe('120px');
    expect(toMaxWidthCommentFormat('120px' as any)).toBe('120px');
    expect(toMaxWidthCommentFormat('abc' as any)).toBe(`${COLUMN_MIN_WIDTH}px`);
  });
});

describe('toZoomFormat', () => {
  it('formats the zoom level as a rounded percentage', () => {
    expect(toZoomFormat(1)).toBe('100%');
    expect(toZoomFormat(0.5)).toBe('50%');
    expect(toZoomFormat(0.1)).toBe('10%');
    expect(toZoomFormat(0.333)).toBe('33%');
    expect(toZoomFormat(0.336)).toBe('34%');
    expect(toZoomFormat(0)).toBe('0%');
  });
});

describe('membership helpers', () => {
  it('hasDatabase', () => {
    expect(hasDatabase(Database.MySQL)).toBe(true);
    expect(hasDatabase(Database.PostgreSQL)).toBe(true);
    expect(hasDatabase(Database.Databricks)).toBe(true);
    expect(hasDatabase(Database.Snowflake)).toBe(true);
    expect(hasDatabase(0)).toBe(false);
    expect(hasDatabase(9999)).toBe(false);
  });

  it('hasNameCase', () => {
    expect(hasNameCase(NameCase.camelCase)).toBe(true);
    expect(hasNameCase(NameCase.snakeCase)).toBe(true);
    expect(hasNameCase(9999)).toBe(false);
  });

  it('hasBracketType', () => {
    expect(hasBracketType(BracketType.backtick)).toBe(true);
    expect(hasBracketType(BracketType.none)).toBe(true);
    expect(hasBracketType(9999)).toBe(false);
  });

  it('hasLanguage', () => {
    expect(hasLanguage(Language.TypeScript)).toBe(true);
    expect(hasLanguage(Language.GraphQL)).toBe(true);
    expect(hasLanguage(9999)).toBe(false);
  });

  it('hasColumnType', () => {
    expect(hasColumnType(ColumnType.columnName)).toBe(true);
    expect(hasColumnType(ColumnType.columnComment)).toBe(true);
    expect(hasColumnType(9999)).toBe(false);
  });

  it('hasDatabaseVendor', () => {
    expect(hasDatabaseVendor(DatabaseVendor.MySQL)).toBe(true);
    expect(hasDatabaseVendor(DatabaseVendor.SQLite)).toBe(true);
    expect(hasDatabaseVendor(DatabaseVendor.Databricks)).toBe(true);
    expect(hasDatabaseVendor(DatabaseVendor.Snowflake)).toBe(true);
    expect(hasDatabaseVendor('CockroachDB')).toBe(false);
  });

  it('hasCanvasType', () => {
    expect(hasCanvasType(CanvasType.ERD)).toBe(true);
    expect(hasCanvasType(CanvasType.settings)).toBe(true);
    expect(hasCanvasType('unknown')).toBe(false);
  });
});

describe('textInRange', () => {
  it('never goes below the column minimum width', () => {
    expect(textInRange(0)).toBe(COLUMN_MIN_WIDTH);
    expect(textInRange(-100)).toBe(COLUMN_MIN_WIDTH);
    expect(textInRange(COLUMN_MIN_WIDTH)).toBe(COLUMN_MIN_WIDTH);
    expect(textInRange(180)).toBe(180);
  });
});

describe('toSafeString', () => {
  it('trims strings', () => {
    expect(toSafeString('  hello  ')).toBe('hello');
    expect(toSafeString('')).toBe('');
  });

  it('returns an empty string for non string values', () => {
    expect(toSafeString(null)).toBe('');
    expect(toSafeString(undefined)).toBe('');
    expect(toSafeString(123)).toBe('');
    expect(toSafeString({})).toBe('');
    expect(toSafeString(['a'])).toBe('');
  });
});

describe('isHighLevelTable', () => {
  it('is true at or below 0.7 zoom', () => {
    expect(isHighLevelTable(0.1)).toBe(true);
    expect(isHighLevelTable(0.7)).toBe(true);
  });

  it('is false above 0.7 zoom', () => {
    expect(isHighLevelTable(0.71)).toBe(false);
    expect(isHighLevelTable(1)).toBe(false);
  });
});

describe('isEditableTarget', () => {
  const nest = (parent: Element, child: Element) => {
    parent.appendChild(child);
    return child;
  };

  it('is true for the editing element itself', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', '');
    expect(isEditableTarget(editable)).toBe(true);

    const editableTrue = document.createElement('div');
    editableTrue.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(editableTrue)).toBe(true);
  });

  it('is true for a descendant of an editing element', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const inner = nest(editable, document.createElement('span'));
    expect(isEditableTarget(inner)).toBe(true);

    const label = document.createElement('label');
    const input = nest(label, document.createElement('input'));
    expect(isEditableTarget(input)).toBe(true);
  });

  it('is false for an element outside any editing surface', () => {
    // The column selection state renders no <input> at all: EditInput only
    // mounts one while edit is true, so the copy handler sees the plain host
    // div and column copy stays untouched.
    const root = document.createElement('div');
    root.className = 'root';
    const table = nest(root, document.createElement('div'));
    expect(isEditableTarget(root)).toBe(false);
    expect(isEditableTarget(table)).toBe(false);
  });

  it('is false for a sibling of an editing element', () => {
    const root = document.createElement('div');
    nest(root, document.createElement('textarea'));
    const sibling = nest(root, document.createElement('div'));
    expect(isEditableTarget(sibling)).toBe(false);
  });

  it('is false for null and for a target that is not an element', () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(document)).toBe(false);
    expect(isEditableTarget(new EventTarget())).toBe(false);
    expect(isEditableTarget(document.createTextNode('text'))).toBe(false);
  });
});
