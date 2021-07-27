import {
  AlterTableAddPrimaryKey,
  AlterTableAddUnique,
} from '@vuerd/sql-ddl-parser';

import { getData, uuid } from '@/core/helper';
import {
  SIZE_CANVAS_MAX,
  SIZE_CANVAS_MIN,
  SIZE_MIN_WIDTH,
} from '@/core/layout';
import {
  AlterTableAddColumn,
  AlterTableAddForeignKey,
  AlterTableDropColumn,
  AlterTableDropForeignKey,
  Column,
  CreateIndex,
  CreateTable,
  DropTable,
  IndexColumn,
  Statement,
} from '@/core/parser';
import { createCanvasState } from '@/engine/store/canvas.state';
import { createMemoState } from '@/engine/store/memo.state';
import { createRelationshipState } from '@/engine/store/relationship.state';
import { createTableState } from '@/engine/store/table.state';
import { Helper } from '@@types/core/helper';
import { ExportedStore } from '@@types/engine/store';
import { CanvasState, Database } from '@@types/engine/store/canvas.state';
import { MemoState } from '@@types/engine/store/memo.state';
import { Table } from '@@types/engine/store/table.state';

interface Shape {
  tables: CreateTable[];
  indexes: CreateIndex[];
  primaryKeys: AlterTableAddPrimaryKey[];
  foreignKeys: AlterTableAddForeignKey[];
  dropForeignKeys: AlterTableDropForeignKey[];
  uniques: AlterTableAddUnique[];
  addColumns: AlterTableAddColumn[];
  dropColumns: AlterTableDropColumn[];
  dropTable: DropTable[];
}

/**
 * Sorts statements and adds them to shape
 * @param statements List of statements
 * @param shape (optional) Already existing shape that will just add new statements to itself
 * @returns Shape with sorted statements
 */
function reshape(
  statements: Statement[],
  shape: Shape = {
    tables: [],
    indexes: [],
    primaryKeys: [],
    foreignKeys: [],
    dropForeignKeys: [],
    uniques: [],
    addColumns: [],
    dropColumns: [],
    dropTable: [],
  }
): Shape {
  statements.forEach(statement => {
    switch (statement.type) {
      case 'create.table':
        const table = statement;
        const duplicateTable = findByName(shape.tables, table.name);
        if (!duplicateTable && table.name) {
          shape.tables.push(table);
        }
        break;
      case 'create.index':
        const index = statement;
        const duplicateIndex = findByName(shape.indexes, index.name);
        if (!duplicateIndex && index.tableName && index.columns.length) {
          shape.indexes.push(index);
        }
        break;
      case 'alter.table.add.primaryKey':
        const primaryKey = statement;
        const duplicatePK = findByName(shape.primaryKeys, primaryKey.name);
        if (!duplicatePK && primaryKey.name && primaryKey.columnNames.length) {
          shape.primaryKeys.push(primaryKey);
        }
        break;
      case 'alter.table.add.foreignKey':
        const foreignKey = statement;
        const duplicateFK = findByConstraintName(
          shape.foreignKeys,
          foreignKey.constraintName
        );

        if (
          !duplicateFK &&
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
        const duplicateUnique = findByName(shape.uniques, unique.name);
        if (!duplicateUnique && unique.name && unique.columnNames.length) {
          shape.uniques.push(unique);
        }
        break;
      case 'alter.table.add.column':
        const addColumns = statement;
        const duplicateAddColumns = findByName(
          shape.addColumns,
          addColumns.name
        );
        if (
          !duplicateAddColumns &&
          addColumns.name &&
          addColumns.columns.length
        ) {
          shape.addColumns.push(addColumns);
        }
        break;
      case 'alter.table.drop.column':
        const dropColumns = statement;
        const duplicateDropColumns = findByName(
          shape.dropColumns,
          dropColumns.name
        );
        if (
          !duplicateDropColumns &&
          dropColumns.name &&
          dropColumns.columns.length
        ) {
          shape.dropColumns.push(dropColumns);
        }
        break;
      case 'drop.table':
        const dropTable = statement;
        const duplicateDropTable = findByName(shape.dropTable, dropTable.name);
        if (!duplicateDropTable && dropTable.name) {
          shape.dropTable.push(dropTable);
        }
        break;
      case 'alter.table.drop.foreignKey':
        const dropForeignKey = statement;
        const duplicateDropFK = findByName(
          shape.dropForeignKeys,
          dropForeignKey.name
        );
        if (
          !duplicateDropFK &&
          dropForeignKey.name &&
          dropForeignKey.baseTableName
        ) {
          shape.dropForeignKeys.push(dropForeignKey);
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

function findByConstraintName<T extends { constraintName: string }>(
  list: T[],
  constraintName: string
): T | null {
  for (const item of list) {
    if (item.constraintName.toUpperCase() === constraintName.toUpperCase()) {
      return item;
    }
  }
  return null;
}

/**
 * Adds all statements to CreateTable[]
 * @param shape Shape with all statements
 * @returns Final list of CreateTable[]
 */
function mergeTable(shape: Shape): CreateTable[] {
  const {
    indexes,
    primaryKeys,
    foreignKeys,
    uniques,
    addColumns,
    dropColumns,
    dropForeignKeys,
    dropTable,
  } = shape;
  var { tables } = shape;

  indexes.forEach(index => {
    const table = findByName(tables, index.tableName);
    if (table) {
      table.indexes.push({
        name: index.name,
        unique: index.unique,
        columns: index.columns,
        id: index.id,
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
        constraintName: foreignKey.constraintName,
        visible: foreignKey.visible,
        id: foreignKey.id,
      });
    }
  });

  addColumns.forEach(addColumn => {
    const table = findByName(tables, addColumn.name);
    if (table) {
      addColumn.columns.forEach(column => {
        const duplicateColumn = findByName(table.columns, column.name);
        if (!duplicateColumn) {
          table.columns.push(column);
        }
      });
    }
  });

  dropColumns.forEach(dropColumn => {
    const table = findByName(tables, dropColumn.name);
    if (table) {
      dropColumn.columns.forEach(columnToDrop => {
        table.columns = table.columns.filter(
          column => columnToDrop.name !== column.name
        );
      });
    }
  });

  dropTable.forEach(dropTable => {
    tables = tables.filter(table => table.name !== dropTable.name);
  });

  dropForeignKeys.forEach(dropForeignKey => {
    const table = findByName(tables, dropForeignKey.baseTableName);
    if (table) {
      table.foreignKeys = table.foreignKeys.filter(
        fk => fk.constraintName !== dropForeignKey.name
      );
    }
  });

  return tables;
}

/**
 * Converts latest snapshot to shape, so there can be added more new statements
 * @param snaphot Latest snapshot
 * @returns Shape with all statements needed to replicate latest snapshot
 */
function snapshotToShape({ table, relationship }: ExportedStore): Shape {
  const shape: Shape = {
    tables: [],
    indexes: [],
    primaryKeys: [],
    foreignKeys: [],
    dropForeignKeys: [],
    uniques: [],
    addColumns: [],
    dropColumns: [],
    dropTable: [],
  };

  shape.tables.push(
    ...table.tables.map(table => {
      const columns: Column[] = table.columns.map(column => {
        return {
          name: column.name,
          dataType: column.dataType,
          default: column.default,
          comment: column.comment,
          primaryKey: column.option.primaryKey,
          autoIncrement: column.option.autoIncrement,
          unique: column.option.unique,
          nullable: !column.option.notNull,
          id: column.id,
        };
      });
      var createTable: CreateTable = {
        type: 'create.table',
        id: table.id,
        columns: columns,
        comment: table.comment,
        foreignKeys: [],
        indexes: [],
        name: table.name,
        visible: table.visible,
      };

      return createTable;
    })
  );

  shape.indexes.push(
    ...table.indexes.map(index => {
      const indexedTable = getData(table.tables, index.tableId);
      const indexedColumns: IndexColumn[] = [];

      if (indexedTable) {
        index.columns.forEach(col => {
          const column = getData(indexedTable.columns, col.id);
          if (column)
            indexedColumns.push({ name: column.name, sort: col.orderType });
        });
      }

      var createIndex: CreateIndex = {
        type: 'create.index',
        id: index.id,
        name: index.name,
        unique: index.unique,
        tableName: indexedTable?.name || '',
        columns: indexedColumns,
      };

      return createIndex;
    })
  );

  shape.foreignKeys.push(
    ...relationship.relationships.map(relationship => {
      const baseTable = getData(table.tables, relationship.end.tableId);
      const baseColumnNames = relationship.end.columnIds.map(colId => {
        return getData(baseTable?.columns || [], colId)?.name || '';
      });

      const refTable = getData(table.tables, relationship.start.tableId);
      const refColumnNames = relationship.start.columnIds.map(colId => {
        return getData(refTable?.columns || [], colId)?.name || '';
      });

      const fk: AlterTableAddForeignKey = {
        type: 'alter.table.add.foreignKey',
        id: relationship.id,
        name: baseTable?.name || '',
        columnNames: baseColumnNames,
        refTableName: refTable?.name || '',
        refColumnNames: refColumnNames,
        constraintName: relationship.constraintName,
        visible: relationship.visible,
      };

      return fk;
    })
  );

  return shape;
}

function createJsonFormat(
  canvasSize: number,
  database: Database,
  originalCanvas?: CanvasState,
  originalMemo?: MemoState
): ExportedStore {
  const canvas: CanvasState = createCanvasState();
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  canvas.database = database;
  return {
    canvas: originalCanvas ? originalCanvas : canvas,
    table: createTableState(),
    memo: originalMemo ? originalMemo : createMemoState(),
    relationship: createRelationshipState(),
  };
}

export function createJson(
  statements: Statement[],
  helper: Helper,
  database: Database,
  snapshot?: ExportedStore
): string {
  var shape: Shape;

  if (snapshot) {
    shape = snapshotToShape(snapshot);
    shape = reshape(statements, shape);
  } else {
    shape = reshape(statements);
  }

  const tables: CreateTable[] = mergeTable(shape);

  let canvasSize = tables.length * 100;
  if (canvasSize < SIZE_CANVAS_MIN) {
    canvasSize = SIZE_CANVAS_MIN;
  }
  if (canvasSize > SIZE_CANVAS_MAX) {
    canvasSize = SIZE_CANVAS_MAX;
  }

  var store: ExportedStore;
  if (snapshot) {
    store = createJsonFormat(
      canvasSize,
      database,
      snapshot.canvas,
      snapshot.memo
    );
  } else {
    store = createJsonFormat(canvasSize, database);
  }

  tables.forEach(table => {
    store.table.tables.push(createTable(helper, table, snapshot?.table.tables));
  });
  createRelationship(store, tables);
  createIndex(store, tables);

  return JSON.stringify(store);
}

function createTable(
  helper: Helper,
  table: CreateTable,
  snapTables?: Table[]
): any {
  const originalTable = findByName(snapTables || [], table.name);

  const newTable = {
    id: table.id || uuid(),
    name: table.name,
    comment: table.comment,
    columns: [],
    ui: originalTable
      ? originalTable.ui
      : {
          active: false,
          top: 0,
          left: 0,
          widthName: SIZE_MIN_WIDTH,
          widthComment: SIZE_MIN_WIDTH,
          zIndex: 2,
        },
    visible: table.visible === undefined ? true : table.visible,
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
    id: column.id || uuid(),
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

function createRelationship(data: ExportedStore, tables: CreateTable[]) {
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

            if (startTable.visible && endTable.visible) {
              foreignKey.visible = true;
            } else {
              foreignKey.visible = false;
            }

            data.relationship.relationships.push({
              id: foreignKey.id || uuid(),
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
              constraintName: foreignKey.constraintName,
              visible: foreignKey.visible,
            });
          }
        });
      }
    }
  });
}

function createIndex(data: ExportedStore, tables: CreateTable[]) {
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
              id: index.id || uuid(),
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
