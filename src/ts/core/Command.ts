import { Store } from "./Store";
import { Logger } from "./Logger";
import { Memo } from "./store/Memo";
import { Relationship } from "./store/Relationship";
import {
  AddTable,
  MoveTable,
  RemoveTable,
  SelectTable,
  SelectOnlyTable,
  ChangeTableValue,
  DragSelectTable,
  LoadTable,
  executeAddTable,
  executeAddOnlyTable,
  executeMoveTable,
  executeRemoveTable,
  executeSelectTable,
  executeSelectEndTable,
  executeSelectAllTable,
  executeSelectOnlyTable,
  executeChangeTableName,
  executeChangeTableComment,
  executeDragSelectTable,
  executeSortTable,
  executeLoadTable,
} from "./command/table";
import {
  AddColumn,
  AddCustomColumn,
  RemoveColumn,
  ChangeColumnValue,
  ChangeColumnOption,
  MoveColumn,
  ActiveColumn,
  LoadColumn,
  executeAddColumn,
  executeAddOnlyColumn,
  executeAddCustomColumn,
  executeRemoveColumn,
  executeChangeColumnName,
  executeChangeColumnComment,
  executeChangeColumnDataType,
  executeChangeColumnDefault,
  executeChangeColumnAutoIncrement,
  executeChangeColumnPrimaryKey,
  executeChangeColumnUnique,
  executeChangeColumnNotNull,
  executeMoveColumn,
  executeActiveColumn,
  executeActiveEndColumn,
  executeLoadColumn,
  executeRemoveOnlyColumn,
} from "./command/column";
import {
  AddRelationship,
  RemoveRelationship,
  ChangeRelationshipType,
  ChangeIdentification,
  executeAddRelationship,
  executeRemoveRelationship,
  executeChangeRelationshipType,
  executeChangeIdentification,
  executeLoadRelationship,
} from "./command/relationship";
import {
  AddIndex,
  RemoveIndex,
  ChangeIndexValue,
  AddIndexColumn,
  RemoveIndexColumn,
  MoveIndexColumn,
  executeAddIndex,
  executeRemoveIndex,
  executeChangeIndexName,
  executeAddIndexColumn,
  executeRemoveIndexColumn,
  executeMoveIndexColumn,
} from "./command/indexes";
import {
  AddMemo,
  MoveMemo,
  RemoveMemo,
  SelectMemo,
  ChangeMemoValue,
  ResizeMemo,
  DragSelectMemo,
  executeAddMemo,
  executeAddOnlyMemo,
  executeMoveMemo,
  executeRemoveMemo,
  executeSelectMemo,
  executeSelectEndMemo,
  executeSelectAllMemo,
  executeChangeMemoValue,
  executeResizeMemo,
  executeDragSelectMemo,
  executeLoadMemo,
} from "./command/memo";
import {
  MoveCanvas,
  ResizeCanvas,
  ChangeCanvasShow,
  ChangeDatabase,
  ChangeDatabaseName,
  ChangeCanvasType,
  ChangeLanguage,
  ChangeNameCase,
  ChangeRelationshipDataTypeSync,
  MoveColumnOrder,
  executeMoveCanvas,
  executeResizeCanvas,
  executeChangeCanvasShow,
  executeChangeDatabase,
  executeChangeDatabaseName,
  executeChangeCanvasType,
  executeChangeLanguage,
  executeChangeTableCase,
  executeChangeColumnCase,
  executeChangeRelationshipDataTypeSync,
  executeMoveColumnOrder,
} from "./command/canvas";
import {
  FocusTable,
  FocusMoveTable,
  FocusTargetTable,
  FocusTargetColumn,
  EditTable,
  DraggableColumn,
  DrawStartRelationship,
  DrawStartAddRelationship,
  DrawRelationship,
  LoadJson,
  CopyColumn,
  PasteColumn,
  AddFilterState,
  RemoveFilterState,
  FocusMoveFilter,
  FocusTargetFilter,
  FocusTargetFilterState,
  EditFilter,
  ChangeFilterStateValue,
  ChangeFilterOperatorType,
  DraggableFilterState,
  MoveFilterState,
  HasUndoRedo,
  executeFocusTable,
  executeFocusTableEnd,
  executeFocusMoveTable,
  executeFocusTargetTable,
  executeFocusTargetColumn,
  executeSelectAllColumn,
  executeSelectEndColumn,
  executeEditTable,
  executeEditTableEnd,
  executeDraggableColumn,
  executeDraggableColumnEnd,
  executeDrawStartRelationship,
  executeDrawStartAddRelationship,
  executeDrawEndRelationship,
  executeDrawRelationship,
  executeLoadJson,
  executeCopyColumn,
  executePasteColumn,
  executeClear,
  executeAddFilterState,
  executeRemoveFilterState,
  executeFocusFilter,
  executeFocusFilterEnd,
  executeFilterActive,
  executeFilterActiveEnd,
  executeFocusMoveFilter,
  executeFocusTargetFilter,
  executeFocusTargetFilterState,
  executeSelectAllFilterState,
  executeSelectEndFilterState,
  executeEditFilter,
  executeEditFilterEnd,
  executeChangeFilterStateColumnType,
  executeChangeFilterStateFilterCode,
  executeChangeFilterStateValue,
  executeChangeFilterOperatorType,
  executeDraggableFilterState,
  executeDraggableFilterStateEnd,
  executeMoveFilterState,
  executeFindActive,
  executeFindActiveEnd,
  executeHasUndoRedo,
} from "./command/editor";
import { ShareMouse, ShareMouseEnd, executeShareMouse } from "./command/share";

export interface User {
  id: string;
  name: string;
}

export interface Command<K extends CommandType> {
  type: K;
  data: CommandMap[K];
  user?: User;
}
export type CommandType = keyof CommandMap;
interface CommandMap {
  // table
  "table.add": AddTable;
  "table.addOnly": AddTable;
  "table.move": MoveTable;
  "table.remove": RemoveTable;
  "table.select": SelectTable;
  "table.selectEnd": null;
  "table.selectAll": null;
  "table.selectOnly": SelectOnlyTable;
  "table.changeName": ChangeTableValue;
  "table.changeComment": ChangeTableValue;
  "table.dragSelect": DragSelectTable;
  "table.sort": null;
  "table.load": LoadTable;
  // column
  "column.add": Array<AddColumn>;
  "column.addOnly": Array<AddColumn>;
  "column.addCustom": Array<AddCustomColumn>;
  "column.remove": RemoveColumn;
  "column.removeOnly": RemoveColumn;
  "column.changeName": ChangeColumnValue;
  "column.changeComment": ChangeColumnValue;
  "column.changeDataType": ChangeColumnValue;
  "column.changeDefault": ChangeColumnValue;
  "column.changeAutoIncrement": ChangeColumnOption;
  "column.changePrimaryKey": ChangeColumnOption;
  "column.changeUnique": ChangeColumnOption;
  "column.changeNotNull": ChangeColumnOption;
  "column.move": MoveColumn;
  "column.active": Array<ActiveColumn>;
  "column.activeEnd": Array<ActiveColumn>;
  "column.load": LoadColumn;
  // relationship
  "relationship.add": AddRelationship;
  "relationship.remove": RemoveRelationship;
  "relationship.changeRelationshipType": ChangeRelationshipType;
  "relationship.changeIdentification": ChangeIdentification;
  "relationship.load": Relationship;
  // index
  "index.add": AddIndex;
  "index.remove": RemoveIndex;
  "index.changeName": ChangeIndexValue;
  "index.addColumn": AddIndexColumn;
  "index.removeColumn": RemoveIndexColumn;
  "index.moveColumn": MoveIndexColumn;
  // memo
  "memo.add": AddMemo;
  "memo.addOnly": AddMemo;
  "memo.move": MoveMemo;
  "memo.remove": RemoveMemo;
  "memo.select": SelectMemo;
  "memo.selectEnd": null;
  "memo.selectAll": null;
  "memo.changeValue": ChangeMemoValue;
  "memo.resize": ResizeMemo;
  "memo.dragSelect": DragSelectMemo;
  "memo.load": Memo;
  // canvas
  "canvas.move": MoveCanvas;
  "canvas.resize": ResizeCanvas;
  "canvas.changeShow": ChangeCanvasShow;
  "canvas.changeDatabase": ChangeDatabase;
  "canvas.changeDatabaseName": ChangeDatabaseName;
  "canvas.changeCanvasType": ChangeCanvasType;
  "canvas.changeLanguage": ChangeLanguage;
  "canvas.changeTableCase": ChangeNameCase;
  "canvas.changeColumnCase": ChangeNameCase;
  "canvas.changeRelationshipDataTypeSync": ChangeRelationshipDataTypeSync;
  "canvas.moveColumnOrder": MoveColumnOrder;
  // editor
  "editor.focusTable": FocusTable;
  "editor.focusTableEnd": null;
  "editor.focusMoveTable": FocusMoveTable;
  "editor.focusTargetTable": FocusTargetTable;
  "editor.focusTargetColumn": FocusTargetColumn;
  "editor.selectAllColumn": null;
  "editor.selectEndColumn": null;
  "editor.editTable": EditTable;
  "editor.editTableEnd": null;
  "editor.draggableColumn": DraggableColumn;
  "editor.draggableColumnEnd": null;
  "editor.drawStartRelationship": DrawStartRelationship;
  "editor.drawStartAddRelationship": DrawStartAddRelationship;
  "editor.drawEndRelationship": null;
  "editor.drawRelationship": DrawRelationship;
  "editor.loadJson": LoadJson;
  "editor.initLoadJson": LoadJson;
  "editor.copyColumn": CopyColumn;
  "editor.pasteColumn": PasteColumn;
  "editor.clear": null;
  "editor.addFilterState": AddFilterState;
  "editor.removeFilterState": RemoveFilterState;
  "editor.focusFilter": null;
  "editor.focusFilterEnd": null;
  "editor.filterActive": null;
  "editor.filterActiveEnd": null;
  "editor.focusMoveFilter": FocusMoveFilter;
  "editor.focusTargetFilter": FocusTargetFilter;
  "editor.focusTargetFilterState": FocusTargetFilterState;
  "editor.selectAllFilterState": null;
  "editor.selectEndFilterState": null;
  "editor.editFilter": EditFilter;
  "editor.editFilterEnd": null;
  "editor.changeFilterStateColumnType": ChangeFilterStateValue;
  "editor.changeFilterStateFilterCode": ChangeFilterStateValue;
  "editor.changeFilterStateValue": ChangeFilterStateValue;
  "editor.changeFilterOperatorType": ChangeFilterOperatorType;
  "editor.draggableFilterState": DraggableFilterState;
  "editor.draggableFilterStateEnd": null;
  "editor.moveFilterState": MoveFilterState;
  "editor.findActive": null;
  "editor.findActiveEnd": null;
  "editor.hasUndoRedo": HasUndoRedo;
  // share
  "share.mouse": ShareMouse;
  "share.mouseEnd": ShareMouseEnd;
}

export const changeCommandTypes: CommandType[] = [
  // table
  "table.add",
  "table.addOnly",
  "table.move",
  "table.remove",
  "table.changeName",
  "table.changeComment",
  "table.sort",
  // column
  "column.add",
  "column.addOnly",
  "column.addCustom",
  "column.remove",
  "column.changeName",
  "column.changeComment",
  "column.changeDataType",
  "column.changeDefault",
  "column.changeAutoIncrement",
  "column.changePrimaryKey",
  "column.changeUnique",
  "column.changeNotNull",
  "column.move",
  // relationship
  "relationship.add",
  "relationship.remove",
  "relationship.changeRelationshipType",
  "relationship.changeIdentification",
  // index
  "index.add",
  "index.remove",
  "index.changeName",
  "index.addColumn",
  "index.removeColumn",
  "index.moveColumn",
  // memo
  "memo.add",
  "memo.addOnly",
  "memo.move",
  "memo.remove",
  "memo.changeValue",
  "memo.resize",
  // canvas
  "canvas.move",
  "canvas.resize",
  "canvas.changeShow",
  "canvas.changeDatabase",
  "canvas.changeDatabaseName",
  "canvas.changeCanvasType",
  "canvas.changeLanguage",
  "canvas.changeTableCase",
  "canvas.changeColumnCase",
  "canvas.changeRelationshipDataTypeSync",
  "canvas.moveColumnOrder",
  // editor
  "editor.loadJson",
  "editor.clear",
];

export const undoCommandTypes: CommandType[] = [
  // table
  "table.add",
  "table.addOnly",
  "table.move",
  "table.remove",
  "table.changeName",
  "table.changeComment",
  "table.sort",
  // column
  "column.add",
  "column.addOnly",
  "column.addCustom",
  "column.remove",
  "column.changeName",
  "column.changeComment",
  "column.changeDataType",
  "column.changeDefault",
  "column.changeAutoIncrement",
  "column.changePrimaryKey",
  "column.changeUnique",
  "column.changeNotNull",
  "column.move",
  // relationship
  "relationship.add",
  "relationship.remove",
  "relationship.changeRelationshipType",
  "relationship.changeIdentification",
  // memo
  "memo.add",
  "memo.addOnly",
  "memo.move",
  "memo.remove",
  "memo.changeValue",
  "memo.resize",
  // canvas
  "canvas.move",
  "canvas.resize",
  "canvas.changeShow",
  "canvas.changeDatabase",
  "canvas.changeDatabaseName",
  // editor
  "editor.loadJson",
  "editor.clear",
];

export const streamCommandTypes: CommandType[] = [
  "table.move",
  "memo.move",
  "memo.resize",
  "canvas.move",
];

export const shareCommandTypes: CommandType[] = [
  // table
  "table.add",
  "table.addOnly",
  "table.move",
  "table.remove",
  "table.changeName",
  "table.changeComment",
  "table.sort",
  // column
  "column.add",
  "column.addOnly",
  "column.addCustom",
  "column.remove",
  "column.changeName",
  "column.changeComment",
  "column.changeDataType",
  "column.changeDefault",
  "column.changeAutoIncrement",
  "column.changePrimaryKey",
  "column.changeUnique",
  "column.changeNotNull",
  "column.move",
  // relationship
  "relationship.add",
  "relationship.remove",
  "relationship.changeRelationshipType",
  "relationship.changeIdentification",
  // index
  "index.add",
  "index.remove",
  "index.changeName",
  "index.addColumn",
  "index.removeColumn",
  "index.moveColumn",
  // memo
  "memo.add",
  "memo.addOnly",
  "memo.move",
  "memo.remove",
  "memo.changeValue",
  "memo.resize",
  // canvas
  "canvas.resize",
  "canvas.changeShow",
  "canvas.changeDatabase",
  "canvas.changeDatabaseName",
  "canvas.changeRelationshipDataTypeSync",
  // editor
  "editor.loadJson",
  "editor.clear",
  // share
  "share.mouse",
];

export function executeCommand(
  store: Store,
  commands: Array<Command<CommandType>>
) {
  Logger.debug(
    `executeCommand: ${commands.map((command) => command.type).join(", ")}`
  );
  commands.forEach((command) => {
    if (/^table\./.test(command.type)) {
      executeTableCommand(store, command);
    } else if (/^column\./.test(command.type)) {
      executeColumnCommand(store, command);
    } else if (/^relationship\./.test(command.type)) {
      executeRelationshipCommand(store, command);
    } else if (/^index\./.test(command.type)) {
      executeIndexCommand(store, command);
    } else if (/^memo\./.test(command.type)) {
      executeMemoCommand(store, command);
    } else if (/^canvas\./.test(command.type)) {
      executeCanvasCommand(store, command);
    } else if (/^editor\./.test(command.type)) {
      executeEditorCommand(store, command);
    } else if (/^share\./.test(command.type)) {
      executeShareCommand(store, command);
    }
  });
}

function executeTableCommand(store: Store, command: Command<CommandType>) {
  switch (command.type) {
    case "table.add":
      executeAddTable(store, command.data as AddTable);
      break;
    case "table.addOnly":
      executeAddOnlyTable(store, command.data as AddTable);
      break;
    case "table.move":
      executeMoveTable(store, command.data as MoveTable);
      break;
    case "table.remove":
      executeRemoveTable(store, command.data as RemoveTable);
      break;
    case "table.select":
      executeSelectTable(store, command.data as SelectTable);
      break;
    case "table.selectEnd":
      executeSelectEndTable(store);
      break;
    case "table.selectAll":
      executeSelectAllTable(store);
      break;
    case "table.selectOnly":
      executeSelectOnlyTable(store, command.data as SelectOnlyTable);
      break;
    case "table.changeName":
      executeChangeTableName(store, command.data as ChangeTableValue);
      break;
    case "table.changeComment":
      executeChangeTableComment(store, command.data as ChangeTableValue);
      break;
    case "table.dragSelect":
      executeDragSelectTable(store, command.data as DragSelectTable);
      break;
    case "table.sort":
      executeSortTable(store);
      break;
    case "table.load":
      executeLoadTable(store, command.data as LoadTable);
      break;
  }
}

function executeColumnCommand(store: Store, command: Command<CommandType>) {
  switch (command.type) {
    case "column.add":
      executeAddColumn(store, command.data as Array<AddColumn>);
      break;
    case "column.addOnly":
      executeAddOnlyColumn(store, command.data as Array<AddColumn>);
      break;
    case "column.addCustom":
      executeAddCustomColumn(store, command.data as Array<AddCustomColumn>);
      break;
    case "column.remove":
      executeRemoveColumn(store, command.data as RemoveColumn);
      break;
    case "column.removeOnly":
      executeRemoveOnlyColumn(store, command.data as RemoveColumn);
      break;
    case "column.changeName":
      executeChangeColumnName(store, command.data as ChangeColumnValue);
      break;
    case "column.changeComment":
      executeChangeColumnComment(store, command.data as ChangeColumnValue);
      break;
    case "column.changeDataType":
      executeChangeColumnDataType(store, command.data as ChangeColumnValue);
      break;
    case "column.changeDefault":
      executeChangeColumnDefault(store, command.data as ChangeColumnValue);
      break;
    case "column.changeAutoIncrement":
      executeChangeColumnAutoIncrement(
        store,
        command.data as ChangeColumnOption
      );
      break;
    case "column.changePrimaryKey":
      executeChangeColumnPrimaryKey(store, command.data as ChangeColumnOption);
      break;
    case "column.changeUnique":
      executeChangeColumnUnique(store, command.data as ChangeColumnOption);
      break;
    case "column.changeNotNull":
      executeChangeColumnNotNull(store, command.data as ChangeColumnOption);
      break;
    case "column.move":
      executeMoveColumn(store, command.data as MoveColumn);
      break;
    case "column.active":
      executeActiveColumn(store, command.data as Array<ActiveColumn>);
      break;
    case "column.activeEnd":
      executeActiveEndColumn(store, command.data as Array<ActiveColumn>);
      break;
    case "column.load":
      executeLoadColumn(store, command.data as LoadColumn);
      break;
  }
}

function executeRelationshipCommand(
  store: Store,
  command: Command<CommandType>
) {
  switch (command.type) {
    case "relationship.add":
      executeAddRelationship(store, command.data as AddRelationship);
      break;
    case "relationship.remove":
      executeRemoveRelationship(store, command.data as RemoveRelationship);
      break;
    case "relationship.changeRelationshipType":
      executeChangeRelationshipType(
        store,
        command.data as ChangeRelationshipType
      );
      break;
    case "relationship.changeIdentification":
      executeChangeIdentification(store, command.data as ChangeIdentification);
      break;
    case "relationship.load":
      executeLoadRelationship(store, command.data as Relationship);
      break;
  }
}

function executeIndexCommand(store: Store, command: Command<CommandType>) {
  switch (command.type) {
    case "index.add":
      executeAddIndex(store, command.data as AddIndex);
      break;
    case "index.remove":
      executeRemoveIndex(store, command.data as RemoveIndex);
      break;
    case "index.changeName":
      executeChangeIndexName(store, command.data as ChangeIndexValue);
      break;
    case "index.addColumn":
      executeAddIndexColumn(store, command.data as AddIndexColumn);
      break;
    case "index.removeColumn":
      executeRemoveIndexColumn(store, command.data as RemoveIndexColumn);
      break;
    case "index.moveColumn":
      executeMoveIndexColumn(store, command.data as MoveIndexColumn);
      break;
  }
}

function executeMemoCommand(store: Store, command: Command<CommandType>) {
  switch (command.type) {
    case "memo.add":
      executeAddMemo(store, command.data as AddMemo);
      break;
    case "memo.addOnly":
      executeAddOnlyMemo(store, command.data as AddMemo);
      break;
    case "memo.move":
      executeMoveMemo(store, command.data as MoveMemo);
      break;
    case "memo.remove":
      executeRemoveMemo(store, command.data as RemoveMemo);
      break;
    case "memo.select":
      executeSelectMemo(store, command.data as SelectMemo);
      break;
    case "memo.selectEnd":
      executeSelectEndMemo(store);
      break;
    case "memo.selectAll":
      executeSelectAllMemo(store);
      break;
    case "memo.changeValue":
      executeChangeMemoValue(store, command.data as ChangeMemoValue);
      break;
    case "memo.resize":
      executeResizeMemo(store, command.data as ResizeMemo);
      break;
    case "memo.dragSelect":
      executeDragSelectMemo(store, command.data as DragSelectMemo);
      break;
    case "memo.load":
      executeLoadMemo(store, command.data as Memo);
      break;
  }
}

function executeCanvasCommand(store: Store, command: Command<CommandType>) {
  switch (command.type) {
    case "canvas.move":
      executeMoveCanvas(store, command.data as MoveCanvas);
      break;
    case "canvas.resize":
      executeResizeCanvas(store, command.data as ResizeCanvas);
      break;
    case "canvas.changeShow":
      executeChangeCanvasShow(store, command.data as ChangeCanvasShow);
      break;
    case "canvas.changeDatabase":
      executeChangeDatabase(store, command.data as ChangeDatabase);
      break;
    case "canvas.changeDatabaseName":
      executeChangeDatabaseName(store, command.data as ChangeDatabaseName);
      break;
    case "canvas.changeCanvasType":
      executeChangeCanvasType(store, command.data as ChangeCanvasType);
      break;
    case "canvas.changeLanguage":
      executeChangeLanguage(store, command.data as ChangeLanguage);
      break;
    case "canvas.changeTableCase":
      executeChangeTableCase(store, command.data as ChangeNameCase);
      break;
    case "canvas.changeColumnCase":
      executeChangeColumnCase(store, command.data as ChangeNameCase);
      break;
    case "canvas.changeRelationshipDataTypeSync":
      executeChangeRelationshipDataTypeSync(
        store,
        command.data as ChangeRelationshipDataTypeSync
      );
      break;
    case "canvas.moveColumnOrder":
      executeMoveColumnOrder(store, command.data as MoveColumnOrder);
      break;
  }
}

function executeEditorCommand(store: Store, command: Command<CommandType>) {
  switch (command.type) {
    case "editor.focusTable":
      executeFocusTable(store, command.data as FocusTable);
      break;
    case "editor.focusTableEnd":
      executeFocusTableEnd(store);
      break;
    case "editor.focusMoveTable":
      executeFocusMoveTable(store, command.data as FocusMoveTable);
      break;
    case "editor.focusTargetTable":
      executeFocusTargetTable(store, command.data as FocusTargetTable);
      break;
    case "editor.focusTargetColumn":
      executeFocusTargetColumn(store, command.data as FocusTargetColumn);
      break;
    case "editor.selectAllColumn":
      executeSelectAllColumn(store);
      break;
    case "editor.selectEndColumn":
      executeSelectEndColumn(store);
      break;
    case "editor.editTable":
      executeEditTable(store, command.data as EditTable);
      break;
    case "editor.editTableEnd":
      executeEditTableEnd(store);
      break;
    case "editor.draggableColumn":
      executeDraggableColumn(store, command.data as DraggableColumn);
      break;
    case "editor.draggableColumnEnd":
      executeDraggableColumnEnd(store);
      break;
    case "editor.drawStartRelationship":
      executeDrawStartRelationship(
        store,
        command.data as DrawStartRelationship
      );
      break;
    case "editor.drawStartAddRelationship":
      executeDrawStartAddRelationship(
        store,
        command.data as DrawStartAddRelationship
      );
      break;
    case "editor.drawEndRelationship":
      executeDrawEndRelationship(store);
      break;
    case "editor.drawRelationship":
      executeDrawRelationship(store, command.data as DrawRelationship);
      break;
    case "editor.loadJson":
      executeLoadJson(store, command.data as LoadJson);
      break;
    case "editor.initLoadJson":
      executeLoadJson(store, command.data as LoadJson);
      break;
    case "editor.copyColumn":
      executeCopyColumn(store, command.data as CopyColumn);
      break;
    case "editor.pasteColumn":
      executePasteColumn(store, command.data as PasteColumn);
      break;
    case "editor.clear":
      executeClear(store);
      break;
    case "editor.addFilterState":
      executeAddFilterState(store, command.data as AddFilterState);
      break;
    case "editor.removeFilterState":
      executeRemoveFilterState(store, command.data as RemoveFilterState);
      break;
    case "editor.focusFilter":
      executeFocusFilter(store);
      break;
    case "editor.focusFilterEnd":
      executeFocusFilterEnd(store);
      break;
    case "editor.filterActive":
      executeFilterActive(store);
      break;
    case "editor.filterActiveEnd":
      executeFilterActiveEnd(store);
      break;
    case "editor.focusMoveFilter":
      executeFocusMoveFilter(store, command.data as FocusMoveFilter);
      break;
    case "editor.focusTargetFilter":
      executeFocusTargetFilter(store, command.data as FocusTargetFilter);
      break;
    case "editor.focusTargetFilterState":
      executeFocusTargetFilterState(
        store,
        command.data as FocusTargetFilterState
      );
      break;
    case "editor.selectAllFilterState":
      executeSelectAllFilterState(store);
      break;
    case "editor.selectEndFilterState":
      executeSelectEndFilterState(store);
      break;
    case "editor.editFilter":
      executeEditFilter(store, command.data as EditFilter);
      break;
    case "editor.editFilterEnd":
      executeEditFilterEnd(store);
      break;
    case "editor.changeFilterStateColumnType":
      executeChangeFilterStateColumnType(
        store,
        command.data as ChangeFilterStateValue
      );
      break;
    case "editor.changeFilterStateFilterCode":
      executeChangeFilterStateFilterCode(
        store,
        command.data as ChangeFilterStateValue
      );
      break;
    case "editor.changeFilterStateValue":
      executeChangeFilterStateValue(
        store,
        command.data as ChangeFilterStateValue
      );
      break;
    case "editor.changeFilterOperatorType":
      executeChangeFilterOperatorType(
        store,
        command.data as ChangeFilterOperatorType
      );
      break;
    case "editor.draggableFilterState":
      executeDraggableFilterState(store, command.data as DraggableFilterState);
      break;
    case "editor.draggableFilterStateEnd":
      executeDraggableFilterStateEnd(store);
      break;
    case "editor.moveFilterState":
      executeMoveFilterState(store, command.data as MoveFilterState);
      break;
    case "editor.findActive":
      executeFindActive(store);
      break;
    case "editor.findActiveEnd":
      executeFindActiveEnd(store);
      break;
    case "editor.hasUndoRedo":
      executeHasUndoRedo(store, command.data as HasUndoRedo);
      break;
  }
}

export function executeShareCommand(
  store: Store,
  command: Command<CommandType>
) {
  if (command.user) {
    switch (command.type) {
      case "share.mouse":
        executeShareMouse(store, command.data as ShareMouse, command.user);
        break;
    }
  }
}
