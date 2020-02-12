import { uuid, getTextWidth } from "./util";
import { SIZE_MIN_WIDTH, SIZE_CANVAS_MIN, SIZE_CANVAS_MAX } from "./layout";
import { Direction, RelationshipType } from "@/store/relationship";
import { Database } from "@/data/DataType";

export interface ParserTable {
  name: string;
  columns: ParserColumn[];
  primaryKey?: { columns: ParserTableColumn[] };
  uniqueKeys?: UniqueKey[];
  foreignKeys?: ForeignKey[];
  indexes?: Index[];
  options?: ParserTableOption;
}

export interface ParserTableOption {
  comment?: string;
  engine?: string;
}

export interface ParserTableColumn {
  column: string;
  length?: number;
}

export interface ForeignKey {
  name: string;
  columns: ParserTableColumn[];
  reference: ParserTableReference;
}

export interface UniqueKey {
  name: string;
  columns: ParserTableColumn[];
}

export interface Index {
  name: string;
  columns: ParserTableColumn[];
}

export interface ParserTableReference {
  table: string;
  columns: ParserTableColumn[];
}

export interface ParserColumn {
  name: string;
  type: ParserColumnType;
  options?: ParserColumnOption;
}

export interface ParserColumnType {
  datatype: string;
  width?: number;
  length?: number;
  fractional?: number;
}

export interface ParserColumnOption {
  nullable?: boolean;
  default?: string | number;
  autoincrement?: boolean;
  comment?: string;
}

class ConvertParserJsonToERD {
  public toERD(tables: ParserTable[], database: Database): string {
    let canvasSize = tables.length * 100;
    if (canvasSize < SIZE_CANVAS_MIN) {
      canvasSize = SIZE_CANVAS_MIN;
    }
    if (canvasSize > SIZE_CANVAS_MAX) {
      canvasSize = SIZE_CANVAS_MAX;
    }
    const data = this.createData(canvasSize, database);
    tables.forEach(table => {
      data.table.tables.push(this.createTable(table));
    });
    this.createRelationship(data, tables);
    return JSON.stringify(data);
  }

  private createData(canvasSize: number, database: Database): any {
    return {
      canvas: {
        width: canvasSize,
        height: canvasSize,
        scrollTop: 0,
        scrollLeft: 0,
        show: {
          tableComment: true,
          columnComment: true,
          columnDataType: true,
          columnDefault: true,
          columnAutoIncrement: true,
          columnPrimaryKey: true,
          columnUnique: true,
          columnNotNull: true,
          relationship: true
        },
        database,
        databaseName: "",
        canvasType: "ERD",
        language: "graphql",
        tableCase: "pascalCase",
        columnCase: "camelCase"
      },
      memo: {
        memos: []
      },
      table: {
        tables: [],
        edit: null,
        copyColumns: [],
        columnDraggable: null
      },
      relationship: {
        relationships: [],
        draw: null
      }
    };
  }

  private createTable(table: ParserTable): any {
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
        zIndex: 2
      }
    } as any;
    newTable.name = table.name;
    if (table.options && table.options.comment) {
      newTable.comment = table.options.comment;
    }
    const widthName = getTextWidth(newTable.name);
    if (SIZE_MIN_WIDTH < widthName) {
      newTable.ui.widthName = widthName;
    }
    const widthComment = getTextWidth(newTable.comment);
    if (SIZE_MIN_WIDTH < widthComment) {
      newTable.ui.widthComment = widthComment;
    }

    table.columns.forEach(column => {
      newTable.columns.push(this.createColumn(column));
    });

    if (table.primaryKey) {
      table.primaryKey.columns.forEach(item => {
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
      table.uniqueKeys.forEach(uniqueKey => {
        uniqueKey.columns.forEach(item => {
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

  private createColumn(column: ParserColumn): any {
    const newColumn = {
      id: uuid(),
      name: column.name,
      comment: "",
      dataType: column.type.datatype.toLocaleUpperCase(),
      default: "",
      option: {
        autoIncrement: false,
        primaryKey: false,
        unique: false,
        notNull: false
      },
      ui: {
        active: false,
        pk: false,
        fk: false,
        pfk: false,
        widthName: SIZE_MIN_WIDTH,
        widthComment: SIZE_MIN_WIDTH,
        widthDataType: SIZE_MIN_WIDTH,
        widthDefault: SIZE_MIN_WIDTH
      }
    } as any;
    if (column.type.width !== undefined && column.type.width === 8) {
      newColumn.dataType = "BIGINT";
    } else if (column.type.length !== undefined) {
      newColumn.dataType = `${column.type.datatype.toLocaleUpperCase()}(${
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
    const widthName = getTextWidth(newColumn.name);
    if (SIZE_MIN_WIDTH < widthName) {
      newColumn.ui.widthName = widthName;
    }
    const widthComment = getTextWidth(newColumn.comment);
    if (SIZE_MIN_WIDTH < widthComment) {
      newColumn.ui.widthComment = widthComment;
    }
    const widthDataType = getTextWidth(newColumn.dataType);
    if (SIZE_MIN_WIDTH < widthDataType) {
      newColumn.ui.widthDataType = widthDataType;
    }
    const widthDefault = getTextWidth(newColumn.default);
    if (SIZE_MIN_WIDTH < widthDefault) {
      newColumn.ui.widthDefault = widthDefault;
    }
    return newColumn;
  }

  private createRelationship(data: any, tables: ParserTable[]) {
    tables.forEach(table => {
      if (table.foreignKeys) {
        const endTable = this.findByName(data.table.tables, table.name);
        if (endTable) {
          table.foreignKeys.forEach(foreignKey => {
            const startTable = this.findByName(
              data.table.tables,
              foreignKey.reference.table
            );
            if (startTable) {
              const startColumns: any[] = [];
              const endColumns: any[] = [];
              foreignKey.reference.columns.forEach(item => {
                const column = this.findByName(startTable.columns, item.column);
                if (column) {
                  startColumns.push(column);
                }
              });
              foreignKey.columns.forEach(item => {
                const column = this.findByName(endTable.columns, item.column);
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
                relationshipType: RelationshipType.ZeroOneN,
                start: {
                  tableId: startTable.id,
                  columnIds: startColumns.map(column => column.id),
                  x: 0,
                  y: 0,
                  direction: Direction.top
                },
                end: {
                  tableId: endTable.id,
                  columnIds: endColumns.map(column => column.id),
                  x: 0,
                  y: 0,
                  direction: Direction.top
                }
              });
            }
          });
        }
      }
    });
  }

  private findByName(list: any[], name: string): any | null {
    for (const item of list) {
      if (item.name === name) {
        return item;
      }
    }
    return null;
  }
}

export default new ConvertParserJsonToERD();
