import { Command, CommandType } from "../Command";
import { Store } from "../Store";
import { Logger } from "../Logger";
import { getData } from "../Helper";
import { JsonFormat } from "../File";
import {
  canvasTypeList,
  databaseList,
  languageList,
  nameCaseList,
} from "../store/Canvas";
import { Relationship, RelationshipType } from "../store/Relationship";
import { Memo } from "../store/Memo";
import { Table } from "../store/Table";
import { FocusTableModel, FocusType } from "../model/FocusTableModel";
import { TableModel } from "../model/TableModel";
import { MemoModel } from "../model/MemoModel";
import { RelationshipModel } from "../model/RelationshipModel";
import { relationshipSort } from "../helper/RelationshipHelper";
import { addCustomColumn } from "./column";

export interface FocusTable {
  tableId: string;
}
export function focusTable(tableId: string): Command<"editor.focusTable"> {
  return {
    type: "editor.focusTable",
    data: {
      tableId,
    },
  };
}
export function executeFocusTable(store: Store, data: FocusTable) {
  Logger.debug("executeFocusTable");
  const { tableState, editorState } = store;
  const table = getData(tableState.tables, data.tableId);
  if (
    table &&
    (editorState.focusTable === null ||
      editorState.focusTable.id !== data.tableId)
  ) {
    if (editorState.focusTable?.id !== table.id) {
      executeFocusEndTable(store);
      editorState.focusTable = new FocusTableModel(table, store);
    }
  }
}

export function focusEndTable(): Command<"editor.focusEndTable"> {
  return {
    type: "editor.focusEndTable",
    data: null,
  };
}
export function executeFocusEndTable(store: Store) {
  Logger.debug("executeFocusEndTable");
  const { editorState } = store;
  editorState.focusTable?.destroy();
  editorState.focusTable = null;
  executeEditEndTable(store);
}

export const moveKeys: MoveKey[] = [
  "ArrowUp",
  "ArrowRight",
  "ArrowDown",
  "ArrowLeft",
];
export type MoveKey = "ArrowUp" | "ArrowRight" | "ArrowDown" | "ArrowLeft";
export interface FocusMoveTable {
  moveKey: MoveKey;
  shiftKey: boolean;
}
export function focusMoveTable(
  moveKey: MoveKey,
  shiftKey: boolean
): Command<"editor.focusMoveTable"> {
  return {
    type: "editor.focusMoveTable",
    data: {
      moveKey,
      shiftKey,
    },
  };
}
export function executeFocusMoveTable(store: Store, data: FocusMoveTable) {
  Logger.debug("executeFocusMoveTable");
  const { focusTable } = store.editorState;
  focusTable?.move(data);
}

export interface FocusTargetTable {
  focusType: FocusType;
}
export function focusTargetTable(
  focusType: FocusType
): Command<"editor.focusTargetTable"> {
  return {
    type: "editor.focusTargetTable",
    data: {
      focusType,
    },
  };
}
export function executeFocusTargetTable(store: Store, data: FocusTargetTable) {
  Logger.debug("executeFocusTargetTable");
  const { focusTable } = store.editorState;
  focusTable?.focus({
    focusTargetTable: data,
  });
  executeEditEndTable(store);
}

export interface FocusTargetColumn {
  columnId: string;
  focusType: FocusType;
  ctrlKey: boolean;
  shiftKey: boolean;
}
export function focusTargetColumn(
  columnId: string,
  focusType: FocusType,
  ctrlKey: boolean,
  shiftKey: boolean
): Command<"editor.focusTargetColumn"> {
  return {
    type: "editor.focusTargetColumn",
    data: {
      columnId,
      focusType,
      ctrlKey,
      shiftKey,
    },
  };
}
export function executeFocusTargetColumn(
  store: Store,
  data: FocusTargetColumn
) {
  Logger.debug("executeFocusTargetColumn");
  const { focusTable } = store.editorState;
  focusTable?.focus({
    focusTargetColumn: data,
  });
  executeEditEndTable(store);
}

export function selectAllColumn(): Command<"editor.selectAllColumn"> {
  return {
    type: "editor.selectAllColumn",
    data: null,
  };
}
export function executeSelectAllColumn(store: Store) {
  Logger.debug("executeSelectAllColumn");
  const { focusTable } = store.editorState;
  focusTable?.selectAll();
}

export function selectEndColumn(): Command<"editor.selectEndColumn"> {
  return {
    type: "editor.selectEndColumn",
    data: null,
  };
}
export function executeSelectEndColumn(store: Store) {
  Logger.debug("executeSelectEndColumn");
  const { focusTable } = store.editorState;
  focusTable?.selectEnd();
}

export interface EditTable {
  id: string;
  focusType: FocusType;
}
export function editTable(
  id: string,
  focusType: FocusType
): Command<"editor.editTable"> {
  return {
    type: "editor.editTable",
    data: {
      id,
      focusType,
    },
  };
}
export function executeEditTable(store: Store, data: EditTable) {
  Logger.debug("executeEditTable");
  const { editorState } = store;
  editorState.editTable = data;
}

export function editEndTable(): Command<"editor.editEndTable"> {
  return {
    type: "editor.editEndTable",
    data: null,
  };
}
export function executeEditEndTable(store: Store) {
  Logger.debug("executeEditEndTable");
  const { editorState } = store;
  editorState.editTable = null;
}

export interface DraggableColumn {
  tableId: string;
  columnIds: string[];
}
export function draggableColumn(
  store: Store,
  tableId: string,
  columnId: string,
  ctrlKey: boolean
): Command<"editor.draggableColumn"> {
  const columnIds: string[] = [];
  const { focusTable } = store.editorState;
  if (ctrlKey && focusTable) {
    focusTable.selectColumns.forEach((column) => columnIds.push(column.id));
  } else {
    columnIds.push(columnId);
  }
  return {
    type: "editor.draggableColumn",
    data: {
      tableId,
      columnIds,
    },
  };
}
export function executeDraggableColumn(store: Store, data: DraggableColumn) {
  Logger.debug("executeDraggableColumn");
  const { editorState } = store;
  editorState.draggableColumn = data;
}

export function draggableEndColumn(): Command<"editor.draggableEndColumn"> {
  return {
    type: "editor.draggableEndColumn",
    data: null,
  };
}
export function executeDraggableEndColumn(store: Store) {
  Logger.debug("executeDraggableEndColumn");
  const { editorState } = store;
  editorState.draggableColumn = null;
}

export interface DrawStartRelationship {
  relationshipType: RelationshipType;
}
export function drawStartRelationship(
  relationshipType: RelationshipType
): Command<"editor.drawStartRelationship"> {
  return {
    type: "editor.drawStartRelationship",
    data: {
      relationshipType,
    },
  };
}
export function executeDrawStartRelationship(
  store: Store,
  data: DrawStartRelationship
) {
  Logger.debug("executeDrawStartRelationship");
  const { editorState } = store;
  if (
    editorState.drawRelationship?.relationshipType === data.relationshipType
  ) {
    executeDrawEndRelationship(store);
  } else {
    editorState.drawRelationship = {
      relationshipType: data.relationshipType,
      start: null,
      end: {
        x: 0,
        y: 0,
      },
    };
  }
}

export interface DrawStartAddRelationship {
  tableId: string;
}
export function drawStartAddRelationship(
  tableId: string
): Command<"editor.drawStartAddRelationship"> {
  return {
    type: "editor.drawStartAddRelationship",
    data: {
      tableId,
    },
  };
}
export function executeDrawStartAddRelationship(
  store: Store,
  data: DrawStartAddRelationship
) {
  Logger.debug("executeDrawStartAddRelationship");
  const { tables } = store.tableState;
  const { drawRelationship } = store.editorState;
  const table = getData(tables, data.tableId);
  if (drawRelationship && table) {
    if (!table.columns.some((column) => column.option.primaryKey)) {
      store.dispatch(
        addCustomColumn(
          store,
          {
            autoIncrement: false,
            primaryKey: true,
            unique: false,
            notNull: true,
          },
          {
            active: false,
            pk: true,
            fk: false,
            pfk: false,
          },
          null,
          [table.id]
        )
      );
    }
    drawRelationship.start = {
      table,
      x: table.ui.left,
      y: table.ui.top,
    };
  }
}

export function drawEndRelationship(): Command<"editor.drawEndRelationship"> {
  return {
    type: "editor.drawEndRelationship",
    data: null,
  };
}
export function executeDrawEndRelationship(store: Store) {
  Logger.debug("executeDrawEndRelationship");
  store.editorState.drawRelationship = null;
}

export interface DrawRelationship {
  x: number;
  y: number;
}
export function drawRelationship(
  x: number,
  y: number
): Command<"editor.drawRelationship"> {
  return {
    type: "editor.drawRelationship",
    data: {
      x,
      y,
    },
  };
}
export function executeDrawRelationship(store: Store, data: DrawRelationship) {
  Logger.debug("executeDrawRelationship");
  const { drawRelationship } = store.editorState;
  if (drawRelationship?.start) {
    drawRelationship.end.x = data.x;
    drawRelationship.end.y = data.y;
  }
}

export interface LoadJson {
  value: string;
}
export function loadJson(value: string): Command<"editor.loadJson"> {
  return {
    type: "editor.loadJson",
    data: {
      value,
    },
  };
}
export function executeLoadJson(store: Store, data: LoadJson) {
  Logger.debug("executeLoadJson");
  const { canvasState, tableState, memoState, relationshipState } = store;
  tableState.tables.splice(0, tableState.tables.length);
  memoState.memos.splice(0, memoState.memos.length);
  relationshipState.relationships.splice(
    0,
    relationshipState.relationships.length
  );
  const json = JSON.parse(data.value) as JsonFormat;

  const canvasStateAny = store.canvasState as any;
  const canvasJson = json.canvas as any;
  if (typeof canvasJson === "object" && canvasJson !== null) {
    Object.keys(canvasStateAny).forEach((key) => {
      if (canvasJson[key] !== null && canvasJson[key] !== undefined) {
        switch (key) {
          case "show":
            Object.keys(canvasState.show).forEach((showKey) => {
              if (
                canvasJson.show[showKey] !== null &&
                canvasJson.show[showKey] !== undefined &&
                typeof canvasJson.show[showKey] === "boolean"
              ) {
                canvasStateAny.show[showKey] = canvasJson.show[showKey];
              }
            });
            break;
          case "database":
            if (databaseList.some((value) => value === canvasJson.database)) {
              canvasState.database = canvasJson.database;
            }
            break;
          case "canvasType":
            if (
              canvasTypeList.some((value) => value === canvasJson.canvasType)
            ) {
              canvasState.canvasType = canvasJson.canvasType;
            }
            break;
          case "language":
            if (languageList.some((value) => value === canvasJson.language)) {
              canvasState.language = canvasJson.language;
            }
            break;
          case "tableCase":
            if (nameCaseList.some((value) => value === canvasJson.tableCase)) {
              canvasState.tableCase = canvasJson.tableCase;
            }
            break;
          case "columnCase":
            if (nameCaseList.some((value) => value === canvasJson.columnCase)) {
              canvasState.columnCase = canvasJson.columnCase;
            }
            break;
          case "width":
          case "height":
          case "scrollTop":
          case "scrollLeft":
            if (typeof canvasJson[key] === "number") {
              canvasState[key] = canvasJson[key];
            }
            break;
          case "databaseName":
            if (typeof canvasJson[key] === "string") {
              canvasState[key] = canvasJson[key];
            }
            break;
        }
      }
    });
  }

  const tableJson = json.table as any;
  if (typeof tableJson === "object" && tableJson !== null) {
    if (Array.isArray(tableJson.tables)) {
      tableJson.tables.forEach((loadTable: Table) => {
        store.tableState.tables.push(
          new TableModel({ loadTable }, store.canvasState.show)
        );
      });
    }
  }

  const memoJson = json.memo as any;
  if (typeof memoJson === "object" && memoJson !== null) {
    if (Array.isArray(memoJson.memos)) {
      memoJson.memos.forEach((loadMemo: Memo) => {
        store.memoState.memos.push(new MemoModel({ loadMemo }));
      });
    }
  }

  const relationshipJson = json.relationship as any;
  if (typeof relationshipJson === "object" && relationshipJson !== null) {
    if (Array.isArray(relationshipJson.relationships)) {
      relationshipJson.relationships.forEach(
        (loadRelationship: Relationship) => {
          store.relationshipState.relationships.push(
            new RelationshipModel({ loadRelationship })
          );
        }
      );
    }

    relationshipSort(tableState.tables, relationshipState.relationships);
  }
}

export interface CopyColumn {
  tableId: string;
  columnIds: string[];
}
export function copyColumn(
  tableId: string,
  columnIds: string[]
): Command<"editor.copyColumn"> {
  return {
    type: "editor.copyColumn",
    data: {
      tableId,
      columnIds,
    },
  };
}
export function executeCopyColumn(store: Store, data: CopyColumn) {
  Logger.debug("executeCopyColumn");
  const { tables } = store.tableState;
  const { copyColumns } = store.editorState;
  const table = getData(tables, data.tableId);
  if (table) {
    copyColumns.splice(0, copyColumns.length);
    data.columnIds.forEach((columnId) => {
      const column = getData(table.columns, columnId);
      if (column) {
        copyColumns.push(column);
      }
    });
  }
}

export interface PasteColumn {
  tableIds: string[];
}
export function pasteColumn(store: Store): Command<"editor.pasteColumn"> {
  return {
    type: "editor.pasteColumn",
    data: {
      tableIds: store.tableState.tables
        .filter((table) => table.ui.active)
        .map((table) => table.id),
    },
  };
}
export function executePasteColumn(store: Store, data: PasteColumn) {
  Logger.debug("executePasteColumn");
  const { copyColumns } = store.editorState;
  if (copyColumns.length !== 0) {
    const batchCommand: Array<Command<CommandType>> = [];
    copyColumns.forEach((column) => {
      const { option, ui } = column;
      batchCommand.push(
        addCustomColumn(
          store,
          {
            autoIncrement: option.autoIncrement,
            primaryKey: option.primaryKey,
            unique: option.unique,
            notNull: option.notNull,
          },
          {
            active: false,
            pk: option.primaryKey,
            fk: false,
            pfk: false,
          },
          {
            name: column.name,
            dataType: column.dataType,
            default: column.default,
            comment: column.comment,
            widthName: ui.widthName,
            widthDataType: ui.widthDataType,
            widthDefault: ui.widthDefault,
            widthComment: ui.widthComment,
          },
          data.tableIds
        )
      );
    });
    store.dispatch(...batchCommand);
  }
}
