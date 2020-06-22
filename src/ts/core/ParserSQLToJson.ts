import { TableInterface, ColumnInterface } from "sql-ddl-to-json-schema";
import { uuid, Helper } from "./Helper";
import { SIZE_MIN_WIDTH, SIZE_CANVAS_MIN, SIZE_CANVAS_MAX } from "./Layout";
import { JsonFormat } from "./File";
import { createCanvasState, Database } from "./store/Canvas";
import { createTableState } from "./store/Table";
import { createMemoState } from "./store/Memo";
import { createRelationshipState } from "./store/Relationship";

export function createJson(
  tables: TableInterface[],
  helper: Helper,
  database: Database
): string {
  let canvasSize = tables.length * 100;
  if (canvasSize < SIZE_CANVAS_MIN) {
    canvasSize = SIZE_CANVAS_MIN;
  }
  if (canvasSize > SIZE_CANVAS_MAX) {
    canvasSize = SIZE_CANVAS_MAX;
  }
  const data = createJsonFormat(canvasSize, database);
  tables.forEach((table) => {
    data.table.tables.push(createTable(helper, table));
  });
  createRelationship(data, tables);
  createIndex(data, tables);
  return JSON.stringify(data);
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

function createTable(helper: Helper, table: TableInterface): any {
  const newTable = {
    id: uuid(),
    name: table.name,
    comment: "",
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
  newTable.name = table.name;
  if (table.options && table.options.comment) {
    newTable.comment = table.options.comment;
  }
  const widthName = helper.getTextWidth(newTable.name);
  if (SIZE_MIN_WIDTH < widthName) {
    newTable.ui.widthName = widthName;
  }
  const widthComment = helper.getTextWidth(newTable.comment);
  if (SIZE_MIN_WIDTH < widthComment) {
    newTable.ui.widthComment = widthComment;
  }

  table.columns?.forEach((column) => {
    newTable.columns.push(createColumn(helper, column));
  });

  if (table.primaryKey) {
    table.primaryKey?.columns?.forEach((item) => {
      for (const column of newTable.columns) {
        if (column.name === item.column) {
          column.option.primaryKey = true;
          column.ui.pk = true;
          break;
        }
      }
    });
  }
  if (table.uniqueKeys) {
    table.uniqueKeys.forEach((uniqueKey) => {
      uniqueKey.columns.forEach((item) => {
        for (const column of newTable.columns) {
          if (column.name === item.column) {
            column.option.unique = true;
            break;
          }
        }
      });
    });
  }
  return newTable;
}

function createColumn(helper: Helper, column: ColumnInterface): any {
  const newColumn = {
    id: uuid(),
    name: column.name,
    comment: "",
    dataType: column.type.datatype.toUpperCase(),
    default: "",
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
      widthName: SIZE_MIN_WIDTH,
      widthComment: SIZE_MIN_WIDTH,
      widthDataType: SIZE_MIN_WIDTH,
      widthDefault: SIZE_MIN_WIDTH,
    },
  } as any;
  if (column.type.width !== undefined) {
    newColumn.dataType = `${column.type.datatype.toUpperCase()}(${
      column.type.width
    })`;
  } else if (column.type.length !== undefined) {
    newColumn.dataType = `${column.type.datatype.toUpperCase()}(${
      column.type.length
    })`;
  }
  if (column.options && column.options.comment !== undefined) {
    newColumn.comment = column.options.comment;
  }
  if (column.options && column.options.default !== undefined) {
    newColumn.default = `${column.options.default}`;
  }
  if (column.options && column.options.autoincrement !== undefined) {
    newColumn.option.autoIncrement = column.options.autoincrement;
  }
  if (column.options && column.options.nullable !== undefined) {
    newColumn.option.notNull = !column.options.nullable;
  }
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

function createRelationship(data: JsonFormat, tables: TableInterface[]) {
  tables.forEach((table) => {
    if (table.foreignKeys) {
      const endTable = findByName(data.table.tables, table.name);
      if (endTable) {
        table.foreignKeys.forEach((foreignKey) => {
          const startTable = findByName(
            data.table.tables,
            foreignKey.reference.table
          );
          if (startTable) {
            const startColumns: any[] = [];
            const endColumns: any[] = [];
            foreignKey?.reference?.columns?.forEach((item) => {
              if (item.column !== undefined) {
                const column = findByName(startTable.columns, item.column);
                if (column) {
                  startColumns.push(column);
                }
              }
            });
            foreignKey.columns.forEach((item) => {
              if (item.column !== undefined) {
                const column = findByName(endTable.columns, item.column);
                if (column) {
                  endColumns.push(column);
                  if (column.ui.pk) {
                    column.ui.pk = false;
                    column.ui.pfk = true;
                  } else {
                    column.ui.fk = true;
                  }
                }
              }
            });
            data.relationship.relationships.push({
              id: uuid(),
              identification: !endColumns.some((column) => !column.ui.pfk),
              relationshipType: "ZeroOneN",
              start: {
                tableId: startTable.id,
                columnIds: startColumns.map((column) => column.id),
                x: 0,
                y: 0,
                direction: "top",
              },
              end: {
                tableId: endTable.id,
                columnIds: endColumns.map((column) => column.id),
                x: 0,
                y: 0,
                direction: "top",
              },
            });
          }
        });
      }
    }
  });
}

function findByName(list: any[], name: string): any | null {
  for (const item of list) {
    if (item.name === name) {
      return item;
    }
  }
  return null;
}

function createIndex(data: JsonFormat, tables: TableInterface[]) {
  tables.forEach((table) => {
    if (table.indexes) {
      table.indexes.forEach((index) => {
        const targetTable = findByName(data.table.tables, table.name);
        if (targetTable) {
          const indexColumns: any[] = [];
          index.columns.forEach((column) => {
            if (column.column && column.sort) {
              const targetColumn = findByName(
                targetTable.columns,
                column.column
              );
              if (targetColumn) {
                indexColumns.push({
                  id: targetColumn.id,
                  orderType: column.sort.toUpperCase(),
                });
              }
            }
          });
          if (indexColumns.length !== 0) {
            data.table.indexes.push({
              id: uuid(),
              name: index.name ? index.name : "",
              tableId: targetTable.id,
              columns: indexColumns,
              unique: false,
            });
          }
        }
      });
    }
  });
}
