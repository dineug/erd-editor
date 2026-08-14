import { describe, expect, it } from 'vitest';

import { createAndMergeCanvasEntity } from '@/v2/parser/canvas';
import {
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
} from '@/v2/schema/canvasEntity';

describe('createAndMergeCanvasEntity', () => {
  it('returns the default entity when json is nill', () => {
    const entity = createAndMergeCanvasEntity();

    expect(entity).toEqual({
      version: '2.2.11',
      width: 2000,
      height: 2000,
      scrollTop: 0,
      scrollLeft: 0,
      zoomLevel: 1,
      show: {
        tableComment: true,
        columnComment: true,
        columnDataType: true,
        columnDefault: true,
        columnAutoIncrement: false,
        columnPrimaryKey: true,
        columnUnique: false,
        columnNotNull: true,
        relationship: true,
      },
      database: 'MySQL',
      databaseName: '',
      canvasType: 'ERD',
      language: 'GraphQL',
      tableCase: 'pascalCase',
      columnCase: 'camelCase',
      highlightTheme: 'VS2015',
      bracketType: 'none',
      setting: {
        relationshipDataTypeSync: true,
        relationshipOptimization: false,
        columnOrder: [
          'columnName',
          'columnDataType',
          'columnNotNull',
          'columnUnique',
          'columnAutoIncrement',
          'columnDefault',
          'columnComment',
        ],
      },
      pluginSerializationMap: {},
    });
    expect(createAndMergeCanvasEntity(null as any)).toEqual(entity);
  });

  it('returns a fresh object on every call', () => {
    const a = createAndMergeCanvasEntity();
    const b = createAndMergeCanvasEntity();

    expect(a).not.toBe(b);
    expect(a.show).not.toBe(b.show);
    expect(a.setting.columnOrder).not.toBe(b.setting.columnOrder);
  });

  it('clamps width and height into the canvas size range', () => {
    expect(createAndMergeCanvasEntity({ width: 0 }).width).toBe(
      CANVAS_SIZE_MIN
    );
    expect(createAndMergeCanvasEntity({ width: 999_999 }).width).toBe(
      CANVAS_SIZE_MAX
    );
    expect(createAndMergeCanvasEntity({ width: 5000 }).width).toBe(5000);
    expect(createAndMergeCanvasEntity({ height: -1 }).height).toBe(
      CANVAS_SIZE_MIN
    );
    expect(createAndMergeCanvasEntity({ height: CANVAS_SIZE_MAX }).height).toBe(
      CANVAS_SIZE_MAX
    );
  });

  it('clamps zoomLevel into the zoom range', () => {
    expect(createAndMergeCanvasEntity({ zoomLevel: 0 }).zoomLevel).toBe(
      CANVAS_ZOOM_MIN
    );
    expect(createAndMergeCanvasEntity({ zoomLevel: 42 }).zoomLevel).toBe(
      CANVAS_ZOOM_MAX
    );
    expect(createAndMergeCanvasEntity({ zoomLevel: 0.5 }).zoomLevel).toBe(0.5);
  });

  it('ignores non-number size and zoom values', () => {
    const entity = createAndMergeCanvasEntity({
      width: '3000',
      height: null,
      zoomLevel: '0.5',
    } as any);

    expect(entity.width).toBe(2000);
    expect(entity.height).toBe(2000);
    expect(entity.zoomLevel).toBe(1);
  });

  it('merges string and number scalars', () => {
    const entity = createAndMergeCanvasEntity({
      version: '3.0.0',
      databaseName: 'sakila',
      scrollTop: -100,
      scrollLeft: 250,
    });

    expect(entity.version).toBe('3.0.0');
    expect(entity.databaseName).toBe('sakila');
    expect(entity.scrollTop).toBe(-100);
    expect(entity.scrollLeft).toBe(250);
  });

  it('ignores scalars with the wrong type', () => {
    const entity = createAndMergeCanvasEntity({
      version: 300,
      databaseName: false,
      scrollTop: '10',
      scrollLeft: {},
    } as any);

    expect(entity.version).toBe('2.2.11');
    expect(entity.databaseName).toBe('');
    expect(entity.scrollTop).toBe(0);
    expect(entity.scrollLeft).toBe(0);
  });

  it('accepts enum-like values that are part of their list', () => {
    const entity = createAndMergeCanvasEntity({
      database: 'PostgreSQL',
      canvasType: '@vuerd/builtin-grid',
      language: 'Kotlin',
      tableCase: 'snakeCase',
      columnCase: 'none',
      highlightTheme: 'GithubGist',
      bracketType: 'backtick',
    });

    expect(entity.database).toBe('PostgreSQL');
    expect(entity.canvasType).toBe('@vuerd/builtin-grid');
    expect(entity.language).toBe('Kotlin');
    expect(entity.tableCase).toBe('snakeCase');
    expect(entity.columnCase).toBe('none');
    expect(entity.highlightTheme).toBe('GithubGist');
    expect(entity.bracketType).toBe('backtick');
  });

  it('rejects enum-like values outside their list', () => {
    const entity = createAndMergeCanvasEntity({
      database: 'CockroachDB',
      canvasType: 'unknown',
      language: 'Rust',
      tableCase: 'kebabCase',
      columnCase: 1,
      highlightTheme: 'Dracula',
      bracketType: 'square',
    } as any);

    expect(entity.database).toBe('MySQL');
    expect(entity.canvasType).toBe('ERD');
    expect(entity.language).toBe('GraphQL');
    expect(entity.tableCase).toBe('pascalCase');
    expect(entity.columnCase).toBe('camelCase');
    expect(entity.highlightTheme).toBe('VS2015');
    expect(entity.bracketType).toBe('none');
  });

  it('merges the show flags', () => {
    const entity = createAndMergeCanvasEntity({
      show: {
        tableComment: false,
        columnComment: false,
        columnDataType: false,
        columnDefault: false,
        columnAutoIncrement: true,
        columnPrimaryKey: false,
        columnUnique: true,
        columnNotNull: false,
        relationship: false,
      },
    });

    expect(entity.show).toEqual({
      tableComment: false,
      columnComment: false,
      columnDataType: false,
      columnDefault: false,
      columnAutoIncrement: true,
      columnPrimaryKey: false,
      columnUnique: true,
      columnNotNull: false,
      relationship: false,
    });
  });

  it('ignores non-boolean show flags', () => {
    const entity = createAndMergeCanvasEntity({
      show: { tableComment: 'false', relationship: 0 },
    } as any);

    expect(entity.show.tableComment).toBe(true);
    expect(entity.show.relationship).toBe(true);
  });

  it('merges the setting booleans', () => {
    const entity = createAndMergeCanvasEntity({
      setting: {
        relationshipDataTypeSync: false,
        relationshipOptimization: true,
      },
    });

    expect(entity.setting.relationshipDataTypeSync).toBe(false);
    expect(entity.setting.relationshipOptimization).toBe(true);
  });

  it('accepts a columnOrder that is a permutation of the full list', () => {
    const columnOrder = [
      'columnComment',
      'columnDefault',
      'columnAutoIncrement',
      'columnUnique',
      'columnNotNull',
      'columnDataType',
      'columnName',
    ];
    const entity = createAndMergeCanvasEntity({
      setting: { columnOrder },
    } as any);

    expect(entity.setting.columnOrder).toEqual(columnOrder);
  });

  it('rejects a columnOrder with a wrong length', () => {
    const entity = createAndMergeCanvasEntity({
      setting: { columnOrder: ['columnName', 'columnDataType'] },
    } as any);

    expect(entity.setting.columnOrder[0]).toBe('columnName');
    expect(entity.setting.columnOrder).toHaveLength(7);
  });

  it('rejects a columnOrder that is missing a member', () => {
    const entity = createAndMergeCanvasEntity({
      setting: {
        columnOrder: [
          'columnName',
          'columnName',
          'columnDataType',
          'columnNotNull',
          'columnUnique',
          'columnAutoIncrement',
          'columnDefault',
        ],
      },
    } as any);

    expect(entity.setting.columnOrder).toEqual([
      'columnName',
      'columnDataType',
      'columnNotNull',
      'columnUnique',
      'columnAutoIncrement',
      'columnDefault',
      'columnComment',
    ]);
  });

  it('keeps the default columnOrder when setting is absent', () => {
    const entity = createAndMergeCanvasEntity({ version: '1.0.0' });

    expect(entity.setting.columnOrder).toEqual([
      'columnName',
      'columnDataType',
      'columnNotNull',
      'columnUnique',
      'columnAutoIncrement',
      'columnDefault',
      'columnComment',
    ]);
  });

  it('copies only string entries of pluginSerializationMap', () => {
    const entity = createAndMergeCanvasEntity({
      pluginSerializationMap: {
        a: 'value-a',
        b: 12 as any,
        c: '',
      },
    } as any);

    expect(entity.pluginSerializationMap).toEqual({ a: 'value-a', c: '' });
  });

  it('ignores a non-object pluginSerializationMap', () => {
    expect(
      createAndMergeCanvasEntity({ pluginSerializationMap: 'nope' } as any)
        .pluginSerializationMap
    ).toEqual({});
    expect(
      createAndMergeCanvasEntity({ pluginSerializationMap: [] } as any)
        .pluginSerializationMap
    ).toEqual({});
    expect(
      createAndMergeCanvasEntity({ pluginSerializationMap: null } as any)
        .pluginSerializationMap
    ).toEqual({});
  });
});
