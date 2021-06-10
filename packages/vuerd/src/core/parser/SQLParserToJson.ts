import { JsonFormat } from '@@types/core/file';
import { Database } from '@@types/engine/store/canvas.state';
import { Helper } from '@@types/core/helper';
import { uuid } from '@/core/helper';
import {
  SIZE_MIN_WIDTH,
  SIZE_CANVAS_MIN,
  SIZE_CANVAS_MAX,
} from '@/core/layout';
import { createCanvasState } from '@/engine/store/canvas.state';
import { createTableState } from '@/engine/store/table.state';
import { createMemoState } from '@/engine/store/memo.state';
import { createRelationshipState } from '@/engine/store/relationship.state';
import {
  CreateTable,
  Column,
  CreateIndex,
  AlterTableAddPrimaryKey,
  AlterTableAddForeignKey,
  AlterTableAddUnique,
} from '@vuerd/sql-ddl-parser';

import { AlterTableAddColumn, Statement } from '@/core/parser';

interface Shape {
  tables: CreateTable[];
  indexes: CreateIndex[];
  primaryKeys: AlterTableAddPrimaryKey[];
  foreignKeys: AlterTableAddForeignKey[];
  uniques: AlterTableAddUnique[];
  addColumns: AlterTableAddColumn[];
}

function reshape(statements: Statement[]): Shape {
  const shape: Shape = {
    tables: [],
    indexes: [],
    primaryKeys: [],
    foreignKeys: [],
    uniques: [],
    addColumns: [],
  };

  statements.forEach(statement => {
    switch (statement.type) {
      case 'create.table':
        const table = statement;
        if (table.name) {
          shape.tables.push(table);
        }
        break;
      case 'create.index':
        const index = statement;
        if (index.tableName && index.columns.length) {
          shape.indexes.push(index);
        }
        break;
      case 'alter.table.add.primaryKey':
        const primaryKey = statement;
        if (primaryKey.name && primaryKey.columnNames.length) {
          shape.primaryKeys.push(primaryKey);
        }
        break;
      case 'alter.table.add.foreignKey':
        const foreignKey = statement;
        if (
          foreignKey.name &&
          foreignKey.columnNames.length &&
          foreignKey.refTableName &&
          foreignKey.refColumnNames.length &&
          foreignKey.columnNames.length === foreignKey.refColumnNames.length
        ) {
          shape.foreignKeys.push(foreignKey);
        }
        break;
      case 'alter.table.add.unique':
        const unique = statement;
        if (unique.name && unique.columnNames.length) {
          shape.uniques.push(unique);
        }
        break;
      case 'alter.table.add.column':
        const addColumns = statement;
        if (addColumns.name && addColumns.columns.length) {
          shape.addColumns.push(addColumns);
        }
        break;
    }
  });

  return shape;
}

function findByName<T extends { name: string }>(
  list: T[],
  name: string
): T | null {
  for (const item of list) {
    if (item.name.toUpperCase() === name.toUpperCase()) {
      return item;
    }
  }
  return null;
}

function mergeTable(shape: Shape): CreateTable[] {
  const { tables, indexes, primaryKeys, foreignKeys, uniques, addColumns } =
    shape;
  indexes.forEach(index => {
    const table = findByName(tables, index.tableName);
    if (table) {
      table.indexes.push({
        name: index.name,
        unique: index.unique,
        columns: index.columns,
      });
    }
  });
  primaryKeys.forEach(primaryKey => {
    const table = findByName(tables, primaryKey.name);
    if (table) {
      primaryKey.columnNames.forEach(columnName => {
        const column = findByName(table.columns, columnName);
        if (column) {
          column.primaryKey = true;
        }
      });
    }
  });
  uniques.forEach(unique => {
    const table = findByName(tables, unique.name);
    if (table) {
      unique.columnNames.forEach(columnName => {
        const column = findByName(table.columns, columnName);
        if (column) {
          column.unique = true;
        }
      });
    }
  });
  foreignKeys.forEach(foreignKey => {
    const table = findByName(tables, foreignKey.name);
    if (table) {
      table.foreignKeys.push({
        columnNames: foreignKey.columnNames,
        refTableName: foreignKey.refTableName,
        refColumnNames: foreignKey.refColumnNames,
      });
    }
  });

  addColumns.forEach(addColumn => {
    const table = findByName(tables, addColumn.name);
    if (table) {
      addColumn.columns.forEach(column => {
        table.columns.push(column);
      });
    }
  });

  return tables;
}

function createJsonFormat(canvasSize: number, database: Database): JsonFormat {
  const canvas = createCanvasState();
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  canvas.database = database;
  return {
    canvas,
    table: createTableState(),
    memo: createMemoState(),
    relationship: createRelationshipState(),
  };
}

export function createJson(
  statements: Statement[],
  helper: Helper,
  database: Database
): string {
  const shape = reshape(statements);
  const tables = mergeTable(shape);

  let canvasSize = tables.length * 100;
  if (canvasSize < SIZE_CANVAS_MIN) {
    canvasSize = SIZE_CANVAS_MIN;
  }
  if (canvasSize > SIZE_CANVAS_MAX) {
    canvasSize = SIZE_CANVAS_MAX;
  }

  const data = createJsonFormat(canvasSize, database);
  tables.forEach(table => {
    data.table.tables.push(createTable(helper, table));
  });
  createRelationship(data, tables);
  createIndex(data, tables);

  return JSON.stringify(data);
}

function createTable(helper: Helper, table: CreateTable): any {
  const newTable = {
    id: uuid(),
    name: table.name,
    comment: table.comment,
    columns: [],
    ui: {
      active: false,
      top: 0,
      left: 0,
      widthName: SIZE_MIN_WIDTH,
      widthComment: SIZE_MIN_WIDTH,
      zIndex: 2,
    },
  } as any;

  const widthName = helper.getTextWidth(newTable.name);
  if (SIZE_MIN_WIDTH < widthName) {
    newTable.ui.widthName = widthName;
  }
  const widthComment = helper.getTextWidth(newTable.comment);
  if (SIZE_MIN_WIDTH < widthComment) {
    newTable.ui.widthComment = widthComment;
  }

  table.columns.forEach(column => {
    newTable.columns.push(createColumn(helper, column));
  });

  return newTable;
}

function createColumn(helper: Helper, column: Column): any {
  const newColumn = {
    id: uuid(),
    name: column.name,
    comment: column.comment,
    dataType: column.dataType,
    default: column.default,
    option: {
      autoIncrement: column.autoIncrement,
      primaryKey: column.primaryKey,
      unique: column.unique,
      notNull: !column.nullable,
    },
    ui: {
      active: false,
      pk: column.primaryKey,
      fk: false,
      pfk: false,
      widthName: SIZE_MIN_WIDTH,
      widthComment: SIZE_MIN_WIDTH,
      widthDataType: SIZE_MIN_WIDTH,
      widthDefault: SIZE_MIN_WIDTH,
    },
  } as any;

  const widthName = helper.getTextWidth(newColumn.name);
  if (SIZE_MIN_WIDTH < widthName) {
    newColumn.ui.widthName = widthName;
  }
  const widthComment = helper.getTextWidth(newColumn.comment);
  if (SIZE_MIN_WIDTH < widthComment) {
    newColumn.ui.widthComment = widthComment;
  }
  const widthDataType = helper.getTextWidth(newColumn.dataType);
  if (SIZE_MIN_WIDTH < widthDataType) {
    newColumn.ui.widthDataType = widthDataType;
  }
  const widthDefault = helper.getTextWidth(newColumn.default);
  if (SIZE_MIN_WIDTH < widthDefault) {
    newColumn.ui.widthDefault = widthDefault;
  }

  return newColumn;
}

function createRelationship(data: JsonFormat, tables: CreateTable[]) {
  tables.forEach(table => {
    if (table.foreignKeys) {
      const endTable = findByName(data.table.tables, table.name);

      if (endTable) {
        table.foreignKeys.forEach(foreignKey => {
          const startTable = findByName(
            data.table.tables,
            foreignKey.refTableName
          );

          if (startTable) {
            const startColumns: any[] = [];
            const endColumns: any[] = [];

            foreignKey.refColumnNames.forEach(refColumnName => {
              const column = findByName(startTable.columns, refColumnName);
              if (column) {
                startColumns.push(column);
              }
            });

            foreignKey.columnNames.forEach(columnName => {
              const column = findByName(endTable.columns, columnName);

              if (column) {
                endColumns.push(column);
                if (column.ui.pk) {
                  column.ui.pk = false;
                  column.ui.pfk = true;
                } else {
                  column.ui.fk = true;
                }
              }
            });

            data.relationship.relationships.push({
              id: uuid(),
              identification: !endColumns.some(column => !column.ui.pfk),
              relationshipType: 'ZeroOneN',
              start: {
                tableId: startTable.id,
                columnIds: startColumns.map(column => column.id),
                x: 0,
                y: 0,
                direction: 'top',
              },
              end: {
                tableId: endTable.id,
                columnIds: endColumns.map(column => column.id),
                x: 0,
                y: 0,
                direction: 'top',
              },
            });
          }
        });
      }
    }
  });
}

function createIndex(data: JsonFormat, tables: CreateTable[]) {
  tables.forEach(table => {
    if (table.indexes) {
      table.indexes.forEach(index => {
        const targetTable = findByName(data.table.tables, table.name);

        if (targetTable) {
          const indexColumns: any[] = [];

          index.columns.forEach(column => {
            const targetColumn = findByName(targetTable.columns, column.name);

            if (targetColumn) {
              indexColumns.push({
                id: targetColumn.id,
                orderType: column.sort,
              });
            }
          });
          if (indexColumns.length !== 0) {
            data.table.indexes.push({
              id: uuid(),
              name: index.name,
              tableId: targetTable.id,
              columns: indexColumns,
              unique: index.unique,
            });
          }
        }
      });
    }
  });
}
