import { Store } from "./Store";
import {
  AddTable,
  MoveTable,
  RemoveTable,
  SelectTable,
  ChangeTableValue,
  DragSelectTable,
  executeAddTable,
  executeMoveTable,
  executeRemoveTable,
  executeSelectTable,
  executeSelectEndTable,
  executeSelectAllTable,
  executeChangeTableName,
  executeChangeTableComment,
  executeDragSelectTable,
  executeSortTable,
} from "./command/table";
import {
  AddColumn,
  AddCustomColumn,
  RemoveColumn,
  ChangeColumnValue,
  ChangeColumnOption,
  MoveColumn,
  ActiveColumn,
  executeAddColumn,
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
} from "./command/relationship";
import {
  AddMemo,
  MoveMemo,
  RemoveMemo,
  SelectMemo,
  ChangeMemoValue,
  ResizeMemo,
  DragSelectMemo,
  executeAddMemo,
  executeMoveMemo,
  executeRemoveMemo,
  executeSelectMemo,
  executeSelectEndMemo,
  executeSelectAllMemo,
  executeChangeMemoValue,
  executeResizeMemo,
  executeDragSelectMemo,
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
  executeMoveCanvas,
  executeResizeCanvas,
  executeChangeCanvasShow,
  executeChangeDatabase,
  executeChangeDatabaseName,
  executeChangeCanvasType,
  executeChangeLanguage,
  executeChangeTableCase,
  executeChangeColumnCase,
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
  executeFocusTable,
  executeFocusEndTable,
  executeFocusMoveTable,
  executeFocusTargetTable,
  executeFocusTargetColumn,
  executeSelectAllColumn,
  executeSelectEndColumn,
  executeEditTable,
  executeEditEndTable,
  executeDraggableColumn,
  executeDraggableEndColumn,
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
  executeFocusEndFilter,
  executeFilterActive,
  executeFilterActiveEnd,
  executeFocusMoveFilter,
  executeFocusTargetFilter,
  executeFocusTargetFilterState,
  executeSelectAllFilterState,
  executeSelectEndFilterState,
  executeEditFilter,
  executeEditEndFilter,
  executeChangeFilterStateColumnType,
  executeChangeFilterStateFilterCode,
  executeChangeFilterStateValue,
  executeChangeFilterOperatorType,
  executeDraggableFilterState,
  executeDraggableEndFilterState,
  executeMoveFilterState,
  executeFindActive,
  executeFindActiveEnd,
} from "./command/editor";

export interface Command<K extends CommandType> {
  type: K;
  data: CommandMap[K];
}
export type CommandType = keyof CommandMap;
interface CommandMap {
  "table.add": AddTable;
  "table.move": MoveTable;
  "table.remove": RemoveTable;
  "table.select": SelectTable;
  "table.selectEnd": null;
  "table.selectAll": null;
  "table.changeName": ChangeTableValue;
  "table.changeComment": ChangeTableValue;
  "table.dragSelect": DragSelectTable;
  "table.sort": null;
  "column.add": Array<AddColumn>;
  "column.addCustom": Array<AddCustomColumn>;
  "column.remove": RemoveColumn;
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
  "relationship.add": AddRelationship;
  "relationship.remove": RemoveRelationship;
  "relationship.changeRelationshipType": ChangeRelationshipType;
  "relationship.changeIdentification": ChangeIdentification;
  "memo.add": AddMemo;
  "memo.move": MoveMemo;
  "memo.remove": RemoveMemo;
  "memo.select": SelectMemo;
  "memo.selectEnd": null;
  "memo.selectAll": null;
  "memo.changeValue": ChangeMemoValue;
  "memo.resize": ResizeMemo;
  "memo.dragSelect": DragSelectMemo;
  "canvas.move": MoveCanvas;
  "canvas.resize": ResizeCanvas;
  "canvas.changeShow": ChangeCanvasShow;
  "canvas.changeDatabase": ChangeDatabase;
  "canvas.changeDatabaseName": ChangeDatabaseName;
  "canvas.changeCanvasType": ChangeCanvasType;
  "canvas.changeLanguage": ChangeLanguage;
  "canvas.changeTableCase": ChangeNameCase;
  "canvas.changeColumnCase": ChangeNameCase;
  "editor.focusTable": FocusTable;
  "editor.focusEndTable": null;
  "editor.focusMoveTable": FocusMoveTable;
  "editor.focusTargetTable": FocusTargetTable;
  "editor.focusTargetColumn": FocusTargetColumn;
  "editor.selectAllColumn": null;
  "editor.selectEndColumn": null;
  "editor.editTable": EditTable;
  "editor.editEndTable": null;
  "editor.draggableColumn": DraggableColumn;
  "editor.draggableEndColumn": null;
  "editor.drawStartRelationship": DrawStartRelationship;
  "editor.drawStartAddRelationship": DrawStartAddRelationship;
  "editor.drawEndRelationship": null;
  "editor.drawRelationship": DrawRelationship;
  "editor.loadJson": LoadJson;
  "editor.copyColumn": CopyColumn;
  "editor.pasteColumn": PasteColumn;
  "editor.clear": null;
  "editor.addFilterState": AddFilterState;
  "editor.removeFilterState": RemoveFilterState;
  "editor.focusFilter": null;
  "editor.focusEndFilter": null;
  "editor.filterActive": null;
  "editor.filterActiveEnd": null;
  "editor.focusMoveFilter": FocusMoveFilter;
  "editor.focusTargetFilter": FocusTargetFilter;
  "editor.focusTargetFilterState": FocusTargetFilterState;
  "editor.selectAllFilterState": null;
  "editor.selectEndFilterState": null;
  "editor.editFilter": EditFilter;
  "editor.editEndFilter": null;
  "editor.changeFilterStateColumnType": ChangeFilterStateValue;
  "editor.changeFilterStateFilterCode": ChangeFilterStateValue;
  "editor.changeFilterStateValue": ChangeFilterStateValue;
  "editor.changeFilterOperatorType": ChangeFilterOperatorType;
  "editor.draggableFilterState": DraggableFilterState;
  "editor.draggableEndFilterState": null;
  "editor.moveFilterState": MoveFilterState;
  "editor.findActive": null;
  "editor.findActiveEnd": null;
}

export const changeCommandTypes: CommandType[] = [
  "table.add",
  "table.move",
  "table.remove",
  "table.changeName",
  "table.changeComment",
  "table.sort",
  "column.add",
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
  "relationship.add",
  "relationship.remove",
  "relationship.changeRelationshipType",
  "relationship.changeIdentification",
  "memo.add",
  "memo.move",
  "memo.remove",
  "memo.changeValue",
  "memo.resize",
  "canvas.move",
  "canvas.resize",
  "canvas.changeShow",
  "canvas.changeDatabase",
  "canvas.changeDatabaseName",
  "canvas.changeCanvasType",
  "canvas.changeLanguage",
  "canvas.changeTableCase",
  "canvas.changeColumnCase",
  "editor.loadJson",
  "editor.clear",
];

export function commandExecute(
  store: Store,
  commands: Array<Command<CommandType>>
) {
  commands.forEach((command) => {
    switch (command.type) {
      case "table.add":
        executeAddTable(store, command.data as AddTable);
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
      case "column.add":
        executeAddColumn(store, command.data as Array<AddColumn>);
        break;
      case "column.addCustom":
        executeAddCustomColumn(store, command.data as Array<AddCustomColumn>);
        break;
      case "column.remove":
        executeRemoveColumn(store, command.data as RemoveColumn);
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
        executeChangeColumnPrimaryKey(
          store,
          command.data as ChangeColumnOption
        );
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
        executeChangeIdentification(
          store,
          command.data as ChangeIdentification
        );
        break;
      case "memo.add":
        executeAddMemo(store, command.data as AddMemo);
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
      case "editor.focusTable":
        executeFocusTable(store, command.data as FocusTable);
        break;
      case "editor.focusEndTable":
        executeFocusEndTable(store);
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
      case "editor.editEndTable":
        executeEditEndTable(store);
        break;
      case "editor.draggableColumn":
        executeDraggableColumn(store, command.data as DraggableColumn);
        break;
      case "editor.draggableEndColumn":
        executeDraggableEndColumn(store);
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
      case "editor.focusEndFilter":
        executeFocusEndFilter(store);
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
      case "editor.editEndFilter":
        executeEditEndFilter(store);
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
        executeDraggableFilterState(
          store,
          command.data as DraggableFilterState
        );
        break;
      case "editor.draggableEndFilterState":
        executeDraggableEndFilterState(store);
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
    }
  });
}
