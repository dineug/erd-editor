import { describe, expect, it } from 'vite-plus/test';

import {
  Column,
  ColumnOption,
  ColumnUI,
  ColumnWidth,
  Index,
  IndexColumn,
  OrderType,
  OrderTypeList,
  Table,
  TableEntity,
  TableUI,
} from '@/v2/schema/tableEntity';

const createColumn = (id: string, name: string): Column => ({
  id,
  name,
  comment: '',
  dataType: 'int',
  default: '',
  option: {
    autoIncrement: false,
    primaryKey: false,
    unique: false,
    notNull: false,
  },
  ui: {
    active: false,
    pk: false,
    fk: false,
    pfk: false,
    widthName: 60,
    widthComment: 60,
    widthDataType: 60,
    widthDefault: 60,
  },
});

describe('v2/schema/tableEntity', () => {
  describe('OrderType', () => {
    it('only supports ASC and DESC', () => {
      expect(OrderType).toEqual({ ASC: 'ASC', DESC: 'DESC' });
    });

    it('exposes OrderTypeList in declaration order', () => {
      expect(OrderTypeList).toEqual(['ASC', 'DESC']);
    });

    it('keeps the list length in sync with the map', () => {
      expect(OrderTypeList).toHaveLength(Object.keys(OrderType).length);
    });

    it('rejects unknown order values through the list membership check', () => {
      expect(OrderTypeList.includes('asc')).toBe(false);
      expect(OrderTypeList.includes(OrderType.DESC)).toBe(true);
    });
  });

  describe('TableEntity shape', () => {
    it('accepts a table with columns, ui and an index', () => {
      const idColumn = createColumn('col-1', 'id');
      idColumn.option = {
        autoIncrement: true,
        primaryKey: true,
        unique: true,
        notNull: true,
      };
      idColumn.ui.pk = true;

      const nameColumn = createColumn('col-2', 'name');
      nameColumn.dataType = 'varchar(255)';

      const ui: TableUI = {
        active: true,
        top: 100,
        left: 200,
        zIndex: 2,
        widthName: 80,
        widthComment: 60,
        color: '#ff0000',
      };
      const table: Table = {
        id: 'table-1',
        name: 'user',
        comment: 'user table',
        columns: [idColumn, nameColumn],
        ui,
        visible: true,
      };
      const indexColumn: IndexColumn = {
        id: 'col-2',
        orderType: OrderType.DESC,
      };
      const index: Index = {
        id: 'index-1',
        name: 'idx_user_name',
        tableId: table.id,
        columns: [indexColumn],
        unique: false,
      };
      const entity: TableEntity = { tables: [table], indexes: [index] };

      expect(entity.tables).toHaveLength(1);
      expect(entity.tables[0].columns.map(column => column.name)).toEqual([
        'id',
        'name',
      ]);
      expect(entity.indexes[0].tableId).toBe('table-1');
      expect(entity.indexes[0].columns[0].orderType).toBe('DESC');
      expect(entity.tables[0].ui.color).toBe('#ff0000');
    });

    it('treats color and visible as optional members', () => {
      const table: Table = {
        id: 'table-2',
        name: 'post',
        comment: '',
        columns: [],
        ui: {
          active: false,
          top: 0,
          left: 0,
          zIndex: 1,
          widthName: 60,
          widthComment: 60,
        },
      };
      const entity: TableEntity = { tables: [table], indexes: [] };

      expect(entity.tables[0].ui.color).toBeUndefined();
      expect(entity.tables[0].visible).toBeUndefined();
      expect(entity.indexes).toEqual([]);
    });
  });

  describe('column value objects', () => {
    it('describes every option flag independently', () => {
      const option: ColumnOption = {
        autoIncrement: true,
        primaryKey: false,
        unique: true,
        notNull: false,
      };

      expect(Object.values(option).filter(Boolean)).toHaveLength(2);
    });

    it('describes the ui key flags for a primary foreign key column', () => {
      const columnUI: ColumnUI = {
        active: false,
        pk: false,
        fk: false,
        pfk: true,
        widthName: 60,
        widthComment: 60,
        widthDataType: 60,
        widthDefault: 60,
      };

      expect(columnUI.pfk).toBe(true);
      expect(columnUI.pk || columnUI.fk).toBe(false);
    });

    it('carries a numeric width per rendered column segment', () => {
      const columnWidth: ColumnWidth = {
        width: 400,
        name: 60,
        comment: 60,
        dataType: 60,
        default: 60,
        notNull: 40,
        autoIncrement: 40,
        unique: 40,
      };

      expect(
        Object.values(columnWidth).every(value => typeof value === 'number')
      ).toBe(true);
      expect(columnWidth.width).toBeGreaterThan(columnWidth.name);
    });
  });
});
