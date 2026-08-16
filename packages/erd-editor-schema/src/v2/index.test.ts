import { describe, expect, it } from 'vite-plus/test';

import { SchemaV2Constants, schemaV2Parser } from '@/v2';
import { parser } from '@/v2/parser';

describe('v2 public surface', () => {
  it('re-exports the v2 parser', () => {
    expect(schemaV2Parser).toBe(parser);
    expect(typeof schemaV2Parser).toBe('function');
  });

  it('parses through the re-exported parser', () => {
    const schema = schemaV2Parser({ canvas: { zoomLevel: 5 } });

    expect(schema.canvas.zoomLevel).toBe(SchemaV2Constants.CANVAS_ZOOM_MAX);
  });

  it('exposes every schema constant', () => {
    expect(Object.keys(SchemaV2Constants).sort()).toEqual(
      [
        'BracketType',
        'BracketTypeList',
        'CANVAS_SIZE_MAX',
        'CANVAS_SIZE_MIN',
        'CANVAS_ZOOM_MAX',
        'CANVAS_ZOOM_MIN',
        'CanvasType',
        'CanvasTypeList',
        'ColumnType',
        'ColumnTypeList',
        'Database',
        'DatabaseList',
        'Direction',
        'DirectionList',
        'HighlightTheme',
        'HighlightThemeList',
        'Language',
        'LanguageList',
        'NameCase',
        'NameCaseList',
        'OrderType',
        'OrderTypeList',
        'RelationshipType',
        'RelationshipTypeList',
        'StartRelationshipType',
        'StartRelationshipTypeList',
      ].sort()
    );
  });

  it('keeps every *List constant in sync with its record', () => {
    const pairs = [
      ['BracketType', 'BracketTypeList'],
      ['CanvasType', 'CanvasTypeList'],
      ['ColumnType', 'ColumnTypeList'],
      ['Database', 'DatabaseList'],
      ['Direction', 'DirectionList'],
      ['HighlightTheme', 'HighlightThemeList'],
      ['Language', 'LanguageList'],
      ['NameCase', 'NameCaseList'],
      ['OrderType', 'OrderTypeList'],
      ['RelationshipType', 'RelationshipTypeList'],
      ['StartRelationshipType', 'StartRelationshipTypeList'],
    ] as const;

    for (const [record, list] of pairs) {
      expect(Object.values(SchemaV2Constants[record])).toEqual(
        SchemaV2Constants[list]
      );
    }
  });

  it('exposes the canvas boundary numbers', () => {
    expect(SchemaV2Constants.CANVAS_SIZE_MIN).toBe(2000);
    expect(SchemaV2Constants.CANVAS_SIZE_MAX).toBe(20000);
    expect(SchemaV2Constants.CANVAS_ZOOM_MIN).toBe(0.1);
    expect(SchemaV2Constants.CANVAS_ZOOM_MAX).toBe(1);
  });
});
