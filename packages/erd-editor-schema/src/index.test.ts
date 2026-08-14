import { describe, expect, it, vi } from 'vitest';

import {
  addOperator,
  parser,
  parserV2,
  query,
  removeOperator,
  replaceOperator,
  SchemaV2Constants,
  schemaV2Parser,
  SchemaV3Constants,
  schemaV3Parser,
  toJson,
} from '@/index';
import { LWW } from '@/v3/schema/lww';

describe('public entry point', () => {
  it('round trips a v3 document through parser and toJson', () => {
    const schema = parser('{"version":"3.0.0","settings":{"width":4000}}');

    expect(JSON.parse(toJson(schema)).settings.width).toBe(4000);
  });

  it('exposes the v2 parser and the v2 downgrade', () => {
    expect(schemaV2Parser({}).canvas.version).toBe('2.2.11');
    expect(parserV2('{"canvas":{"width":3000}}').canvas.width).toBe(3000);
  });

  it('exposes the v3 parser', () => {
    expect(schemaV3Parser({}).version).toBe('3.0.0');
  });

  it('exposes the collections query factory', () => {
    const collections = schemaV3Parser({}).collections;

    expect(query(collections).collection('tableEntities').selectAll()).toEqual(
      []
    );
  });

  it('exposes the lww operators', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    addOperator(lww, 1, 'id', 'tableEntities', recipe);
    replaceOperator(lww, 2, 'id', 'tableEntities', 'name', recipe);
    removeOperator(lww, 3, 'id', 'tableEntities', recipe);

    expect(lww.id).toEqual(['tableEntities', 1, 3, { name: 2 }]);
    expect(recipe).toHaveBeenCalledTimes(3);
  });

  it('exposes both constant bundles', () => {
    expect(SchemaV2Constants.CanvasType.ERD).toBe('ERD');
    expect(SchemaV3Constants.CanvasType.ERD).toBe('ERD');
    expect(SchemaV3Constants.SaveSettingType.scroll).toBe(1);
    expect(SchemaV3Constants.CANVAS_ZOOM_MAX).toBe(1);
  });
});
