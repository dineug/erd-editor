import { Command, CommandType } from "../Command";
import { Store } from "../Store";
import { Logger } from "../Logger";
import { getData, uuid, getIndex, isObject, isEmpty } from "../Helper";
import { JsonFormat } from "../File";
import { MoveKey } from "../Keymap";
import { Relationship, RelationshipType } from "../store/Relationship";
import { Memo } from "../store/Memo";
import {
  canvasTypeList,
  databaseList,
  languageList,
  nameCaseList,
  ColumnType,
} from "../store/Canvas";
import {
  FilterColumnType,
  TextFilterCode,
  FilterState,
  FilterOperatorType,
} from "../store/Editor";
import {
  FocusFilterModel,
  FocusType as FocusFilterType,
} from "../model/FocusFilterModel";
import { FocusTableModel, FocusType } from "../model/FocusTableModel";
import { FilterStateModel } from "../model/FilterModel";
import { relationshipSort } from "../helper/RelationshipHelper";
import { addCustomColumn } from "./column";
import { LoadTable, executeSelectEndTable, executeLoadTable } from "./table";
import { executeSelectEndMemo, executeLoadMemo } from "./memo";
import { executeLoadRelationship } from "./relationship";

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
      executeFocusTableEnd(store);
      editorState.focusTable = new FocusTableModel(table, store);
    }
  }
}

export function focusTableEnd(): Command<"editor.focusTableEnd"> {
  return {
    type: "editor.focusTableEnd",
    data: null,
  };
}
export function executeFocusTableEnd(store: Store) {
  Logger.debug("executeFocusTableEnd");
  const { editorState } = store;
  editorState.focusTable?.destroy();
  editorState.focusTable = null;
  executeEditTableEnd(store);
}

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
  executeEditTableEnd(store);
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
  executeEditTableEnd(store);
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
  executeEditTableEnd(store);
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

export function editTableEnd(): Command<"editor.editTableEnd"> {
  return {
    type: "editor.editTableEnd",
    data: null,
  };
}
export function executeEditTableEnd(store: Store) {
  Logger.debug("executeEditTableEnd");
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

export function draggableColumnEnd(): Command<"editor.draggableColumnEnd"> {
  return {
    type: "editor.draggableColumnEnd",
    data: null,
  };
}
export function executeDraggableColumnEnd(store: Store) {
  Logger.debug("executeDraggableColumnEnd");
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
  const { canvasState, tableState, relationshipState } = store;
  executeClear(store);
  try {
    const json = JSON.parse(data.value) as JsonFormat;

    const canvasStateAny = store.canvasState as any;
    const canvasJson = json.canvas as any;
    if (isObject(canvasJson)) {
      Object.keys(canvasStateAny).forEach((key) => {
        if (!isEmpty(canvasJson[key])) {
          switch (key) {
            case "show":
              Object.keys(canvasState.show).forEach((showKey) => {
                if (typeof canvasJson.show[showKey] === "boolean") {
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
              if (
                nameCaseList.some((value) => value === canvasJson.tableCase)
              ) {
                canvasState.tableCase = canvasJson.tableCase;
              }
              break;
            case "columnCase":
              if (
                nameCaseList.some((value) => value === canvasJson.columnCase)
              ) {
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
            case "setting":
              if (
                typeof canvasJson.setting.relationshipDataTypeSync === "boolean"
              ) {
                canvasState.setting.relationshipDataTypeSync =
                  canvasJson.setting.relationshipDataTypeSync;
              }
              if (
                Array.isArray(canvasJson.setting.columnOrder) &&
                canvasJson.setting.columnOrder.length === 7 &&
                canvasJson.setting.columnOrder.indexOf("columnName") !== -1 &&
                canvasJson.setting.columnOrder.indexOf("columnDataType") !==
                  -1 &&
                canvasJson.setting.columnOrder.indexOf("columnNotNull") !==
                  -1 &&
                canvasJson.setting.columnOrder.indexOf("columnDefault") !==
                  -1 &&
                canvasJson.setting.columnOrder.indexOf("columnComment") !==
                  -1 &&
                canvasJson.setting.columnOrder.indexOf("columnUnique") !== -1 &&
                canvasJson.setting.columnOrder.indexOf(
                  "columnAutoIncrement"
                ) !== -1
              ) {
                canvasState.setting.columnOrder.splice(
                  0,
                  canvasState.setting.columnOrder.length
                );
                canvasState.setting.columnOrder.push(
                  ...canvasJson.setting.columnOrder
                );
              }
              break;
          }
        }
      });
    }

    const tableJson = json.table as any;
    if (isObject(tableJson)) {
      if (Array.isArray(tableJson.tables)) {
        tableJson.tables.forEach((loadTable: LoadTable) => {
          executeLoadTable(store, loadTable);
        });
      }
    }

    const memoJson = json.memo as any;
    if (isObject(memoJson)) {
      if (Array.isArray(memoJson.memos)) {
        memoJson.memos.forEach((loadMemo: Memo) => {
          executeLoadMemo(store, loadMemo);
        });
      }
    }

    const relationshipJson = json.relationship as any;
    if (isObject(relationshipJson)) {
      if (Array.isArray(relationshipJson.relationships)) {
        relationshipJson.relationships.forEach(
          (loadRelationship: Relationship) => {
            executeLoadRelationship(store, loadRelationship);
          }
        );
      }

      relationshipSort(tableState.tables, relationshipState.relationships);
    }
  } catch (err) {
    Logger.error(err);
  }
}

export function initLoadJson(value: string): Command<"editor.initLoadJson"> {
  return {
    type: "editor.initLoadJson",
    data: {
      value,
    },
  };
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

export function clear(): Command<"editor.clear"> {
  return {
    type: "editor.clear",
    data: null,
  };
}
export function executeClear(store: Store) {
  Logger.debug("executeClear");
  const { tables } = store.tableState;
  const { memos } = store.memoState;
  const { relationships } = store.relationshipState;
  tables.splice(0, tables.length);
  memos.splice(0, memos.length);
  relationships.splice(0, relationships.length);
}

export interface AddFilterState {
  id: string;
}
export function addFilterState(): Command<"editor.addFilterState"> {
  return {
    type: "editor.addFilterState",
    data: {
      id: uuid(),
    },
  };
}
export function executeAddFilterState(store: Store, data: AddFilterState) {
  Logger.debug("executeAddFilterState");
  const { filterStateList } = store.editorState;
  executeEditFilterEnd(store);
  filterStateList.push(new FilterStateModel({ addFilterState: data }));
}

export interface RemoveFilterState {
  filterStateIds: string[];
}
export function removeFilterState(
  filterStateIds: string[]
): Command<"editor.removeFilterState"> {
  return {
    type: "editor.removeFilterState",
    data: {
      filterStateIds,
    },
  };
}
export function executeRemoveFilterState(
  store: Store,
  data: RemoveFilterState
) {
  Logger.debug("executeRemoveFilterState");
  const { filterStateList } = store.editorState;
  for (let i = 0; i < filterStateList.length; i++) {
    const id = filterStateList[i].id;
    if (data.filterStateIds.some((filterStateId) => filterStateId === id)) {
      filterStateList.splice(i, 1);
      i--;
    }
  }
}

export function focusFilter(): Command<"editor.focusFilter"> {
  return {
    type: "editor.focusFilter",
    data: null,
  };
}
export function executeFocusFilter(store: Store) {
  Logger.debug("executeFocusFilter");
  const { editorState } = store;
  editorState.focusFilter = new FocusFilterModel(
    editorState.filterStateList,
    store
  );
}

export function focusFilterEnd(): Command<"editor.focusFilterEnd"> {
  return {
    type: "editor.focusFilterEnd",
    data: null,
  };
}
export function executeFocusFilterEnd(store: Store) {
  Logger.debug("executeFocusFilterEnd");
  const { editorState } = store;
  editorState.focusFilter?.destroy();
  editorState.focusFilter = null;
}

export function filterActive(): Command<"editor.filterActive"> {
  return {
    type: "editor.filterActive",
    data: null,
  };
}
export function executeFilterActive(store: Store) {
  Logger.debug("executeFilterActive");
  const { editorState } = store;
  editorState.filterActive = true;
  executeFocusFilter(store);
}

export function filterActiveEnd(): Command<"editor.filterActiveEnd"> {
  return {
    type: "editor.filterActiveEnd",
    data: null,
  };
}
export function executeFilterActiveEnd(store: Store) {
  Logger.debug("executeFilterActiveEnd");
  const { editorState } = store;
  editorState.filterActive = false;
  executeFocusFilterEnd(store);
  executeEditFilterEnd(store);
}

export interface FocusMoveFilter {
  moveKey: MoveKey;
  shiftKey: boolean;
}
export function focusMoveFilter(
  moveKey: MoveKey,
  shiftKey: boolean
): Command<"editor.focusMoveFilter"> {
  return {
    type: "editor.focusMoveFilter",
    data: {
      moveKey,
      shiftKey,
    },
  };
}
export function executeFocusMoveFilter(store: Store, data: FocusMoveFilter) {
  Logger.debug("executeFocusMoveTable");
  const { focusFilter } = store.editorState;
  focusFilter?.move(data);
  executeEditFilterEnd(store);
}

export interface FocusTargetFilter {
  focusType: FocusFilterType;
}
export function focusTargetFilter(
  focusType: FocusFilterType
): Command<"editor.focusTargetFilter"> {
  return {
    type: "editor.focusTargetFilter",
    data: {
      focusType,
    },
  };
}
export function executeFocusTargetFilter(
  store: Store,
  data: FocusTargetFilter
) {
  Logger.debug("executeFocusTargetFilter");
  const { focusFilter } = store.editorState;
  focusFilter?.focus({
    focusTargetFilter: data,
  });
  executeEditFilterEnd(store);
}

export interface FocusTargetFilterState {
  filterStateId: string;
  focusType: FocusFilterType;
  ctrlKey: boolean;
  shiftKey: boolean;
}
export function focusTargetFilterState(
  filterStateId: string,
  focusType: FocusFilterType,
  ctrlKey: boolean,
  shiftKey: boolean
): Command<"editor.focusTargetFilterState"> {
  return {
    type: "editor.focusTargetFilterState",
    data: {
      filterStateId,
      focusType,
      ctrlKey,
      shiftKey,
    },
  };
}
export function executeFocusTargetFilterState(
  store: Store,
  data: FocusTargetFilterState
) {
  Logger.debug("executeFocusTargetFilterState");
  const { focusFilter } = store.editorState;
  focusFilter?.focus({
    focusTargetFilterState: data,
  });
  executeEditFilterEnd(store);
}

export function selectAllFilterState(): Command<"editor.selectAllFilterState"> {
  return {
    type: "editor.selectAllFilterState",
    data: null,
  };
}
export function executeSelectAllFilterState(store: Store) {
  Logger.debug("executeSelectAllFilterState");
  const { focusFilter } = store.editorState;
  focusFilter?.selectAll();
}

export function selectEndFilterState(): Command<"editor.selectEndFilterState"> {
  return {
    type: "editor.selectEndFilterState",
    data: null,
  };
}
export function executeSelectEndFilterState(store: Store) {
  Logger.debug("executeSelectEndFilterState");
  const { focusFilter } = store.editorState;
  focusFilter?.selectEnd();
}

export interface EditFilter {
  id?: string | null;
  focusType: FocusFilterType;
}
export function editFilter(
  focusType: FocusFilterType,
  id?: string | null
): Command<"editor.editFilter"> {
  return {
    type: "editor.editFilter",
    data: {
      id,
      focusType,
    },
  };
}
export function executeEditFilter(store: Store, data: EditFilter) {
  Logger.debug("executeEditFilter");
  const { editorState } = store;
  editorState.editFilter = data;
}

export function editFilterEnd(): Command<"editor.editFilterEnd"> {
  return {
    type: "editor.editFilterEnd",
    data: null,
  };
}
export function executeEditFilterEnd(store: Store) {
  Logger.debug("executeEditFilterEnd");
  const { editorState } = store;
  editorState.editFilter = null;
}

export interface ChangeFilterStateValue {
  filterStateId: string;
  value: string | FilterColumnType | TextFilterCode;
}

export function changeFilterStateColumnType(
  filterStateId: string,
  value: string | FilterColumnType | TextFilterCode
): Command<"editor.changeFilterStateColumnType"> {
  return {
    type: "editor.changeFilterStateColumnType",
    data: {
      filterStateId,
      value,
    },
  };
}
export function executeChangeFilterStateColumnType(
  store: Store,
  data: ChangeFilterStateValue
) {
  Logger.debug("executeChangeFilterStateColumnType");
  const { filterStateList } = store.editorState;
  const filetState = getData(filterStateList, data.filterStateId);
  if (filetState) {
    filetState.columnType = data.value as FilterColumnType;
  }
}

export function changeFilterStateFilterCode(
  filterStateId: string,
  value: string
): Command<"editor.changeFilterStateFilterCode"> {
  return {
    type: "editor.changeFilterStateFilterCode",
    data: {
      filterStateId,
      value,
    },
  };
}
export function executeChangeFilterStateFilterCode(
  store: Store,
  data: ChangeFilterStateValue
) {
  Logger.debug("executeChangeFilterStateFilterCode");
  const { filterStateList } = store.editorState;
  const filetState = getData(filterStateList, data.filterStateId);
  if (filetState) {
    filetState.filterCode = data.value as TextFilterCode;
  }
}

export function changeFilterStateValue(
  filterStateId: string,
  value: string
): Command<"editor.changeFilterStateValue"> {
  return {
    type: "editor.changeFilterStateValue",
    data: {
      filterStateId,
      value,
    },
  };
}
export function executeChangeFilterStateValue(
  store: Store,
  data: ChangeFilterStateValue
) {
  Logger.debug("executeChangeFilterStateValue");
  const { filterStateList } = store.editorState;
  const filetState = getData(filterStateList, data.filterStateId);
  if (filetState) {
    filetState.value = data.value;
  }
}

export interface ChangeFilterOperatorType {
  value: FilterOperatorType;
}
export function changeFilterOperatorType(
  value: FilterOperatorType
): Command<"editor.changeFilterOperatorType"> {
  return {
    type: "editor.changeFilterOperatorType",
    data: {
      value,
    },
  };
}
export function executeChangeFilterOperatorType(
  store: Store,
  data: ChangeFilterOperatorType
) {
  Logger.debug("executeChangeFilterOperatorType");
  store.editorState.filterOperatorType = data.value;
}

export interface DraggableFilterState {
  filterStateIds: string[];
}
export function draggableFilterState(
  store: Store,
  filterStateId: string,
  ctrlKey: boolean
): Command<"editor.draggableFilterState"> {
  const filterStateIds: string[] = [];
  const { focusFilter } = store.editorState;
  if (ctrlKey && focusFilter) {
    focusFilter.selectFilterStateList.forEach((selectFilterState) =>
      filterStateIds.push(selectFilterState.id)
    );
  } else {
    filterStateIds.push(filterStateId);
  }
  return {
    type: "editor.draggableFilterState",
    data: {
      filterStateIds,
    },
  };
}
export function executeDraggableFilterState(
  store: Store,
  data: DraggableFilterState
) {
  Logger.debug("executeDraggableFilterState");
  const { editorState } = store;
  editorState.draggableFilterState = data;
}

export function draggableFilterStateEnd(): Command<
  "editor.draggableFilterStateEnd"
> {
  return {
    type: "editor.draggableFilterStateEnd",
    data: null,
  };
}
export function executeDraggableFilterStateEnd(store: Store) {
  Logger.debug("executeDraggableFilterStateEnd");
  const { editorState } = store;
  editorState.draggableFilterState = null;
}

export interface MoveFilterState {
  filterStateIds: string[];
  targetFilterStateId: string;
}
export function moveFilterState(
  filterStateIds: string[],
  targetFilterStateId: string
): Command<"editor.moveFilterState"> {
  return {
    type: "editor.moveFilterState",
    data: {
      filterStateIds,
      targetFilterStateId,
    },
  };
}
export function executeMoveFilterState(store: Store, data: MoveFilterState) {
  Logger.debug("executeMoveFilterState");
  const { filterStateList } = store.editorState;
  const currentFilterStateList: FilterState[] = [];
  data.filterStateIds.forEach((filterStateId) => {
    const filterState = getData(filterStateList, filterStateId);
    if (filterState) {
      currentFilterStateList.push(filterState);
    }
  });
  const targetFilterState = getData(filterStateList, data.targetFilterStateId);
  if (currentFilterStateList.length !== 0 && targetFilterState) {
    if (
      !data.filterStateIds.some(
        (filterStateId) => filterStateId === data.targetFilterStateId
      )
    ) {
      const targetIndex = getIndex(filterStateList, targetFilterState.id);
      if (targetIndex !== null) {
        currentFilterStateList.forEach((currentFilterState) => {
          const currentIndex = getIndex(filterStateList, currentFilterState.id);
          if (currentIndex !== null) {
            filterStateList.splice(currentIndex, 1);
          }
        });
        filterStateList.splice(targetIndex, 0, ...currentFilterStateList);
      }
    }
  }
}

export function findActive(): Command<"editor.findActive"> {
  return {
    type: "editor.findActive",
    data: null,
  };
}
export function executeFindActive(store: Store) {
  Logger.debug("executeFindActive");
  const { editorState } = store;
  editorState.findActive = true;
  executeSelectEndTable(store);
  executeSelectEndMemo(store);
}

export function findActiveEnd(): Command<"editor.findActiveEnd"> {
  return {
    type: "editor.findActiveEnd",
    data: null,
  };
}
export function executeFindActiveEnd(store: Store) {
  Logger.debug("executeFindActiveEnd");
  const { editorState } = store;
  editorState.findActive = false;
}

export interface HasUndoRedo {
  hasUndo: boolean;
  hasRedo: boolean;
}
export function hasUndoRedo(
  hasUndo: boolean,
  hasRedo: boolean
): Command<"editor.hasUndoRedo"> {
  return {
    type: "editor.hasUndoRedo",
    data: {
      hasUndo,
      hasRedo,
    },
  };
}
export function executeHasUndoRedo(store: Store, data: HasUndoRedo) {
  Logger.debug("executeHasUndoRedo");
  const { editorState } = store;
  editorState.hasUndo = data.hasUndo;
  editorState.hasRedo = data.hasRedo;
}

export interface DraggableColumnOrder {
  columnType: ColumnType;
}
export function draggableColumnOrder(
  columnType: ColumnType
): Command<"editor.draggableColumnOrder"> {
  return {
    type: "editor.draggableColumnOrder",
    data: {
      columnType,
    },
  };
}
export function executeDraggableColumnOrder(
  store: Store,
  data: DraggableColumnOrder
) {
  Logger.debug("executeDraggableColumnOrder");
  const { editorState } = store;
  editorState.draggableColumnOrder = data;
}

export function draggableColumnOrderEnd(): Command<
  "editor.draggableColumnOrderEnd"
> {
  return {
    type: "editor.draggableColumnOrderEnd",
    data: null,
  };
}
export function executeDraggableColumnOrderEnd(store: Store) {
  Logger.debug("executeDraggableColumnOrderEnd");
  const { editorState } = store;
  editorState.draggableColumnOrder = null;
}
