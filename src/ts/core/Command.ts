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
} from "./command/editor";

export interface CommandEffect<T> {
  name: CommandName;
  data: T;
}

type CommandName =
  | "table.add"
  | "table.move"
  | "table.remove"
  | "table.select"
  | "table.selectEnd"
  | "table.selectAll"
  | "table.changeName"
  | "table.changeComment"
  | "table.dragSelect"
  | "column.add"
  | "column.addCustom"
  | "column.remove"
  | "column.changeName"
  | "column.changeComment"
  | "column.changeDataType"
  | "column.changeDefault"
  | "column.changeAutoIncrement"
  | "column.changePrimaryKey"
  | "column.changeUnique"
  | "column.changeNotNull"
  | "column.move"
  | "column.active"
  | "column.activeEnd"
  | "relationship.add"
  | "relationship.remove"
  | "relationship.changeRelationshipType"
  | "relationship.changeIdentification"
  | "memo.add"
  | "memo.move"
  | "memo.remove"
  | "memo.select"
  | "memo.selectEnd"
  | "memo.selectAll"
  | "memo.changeValue"
  | "memo.resize"
  | "memo.dragSelect"
  | "canvas.move"
  | "canvas.resize"
  | "canvas.changeShow"
  | "canvas.changeDatabase"
  | "canvas.changeDatabaseName"
  | "canvas.changeCanvasType"
  | "canvas.changeLanguage"
  | "canvas.changeTableCase"
  | "canvas.changeColumnCase"
  | "editor.focusTable"
  | "editor.focusEndTable"
  | "editor.focusMoveTable"
  | "editor.focusTargetTable"
  | "editor.focusTargetColumn"
  | "editor.selectAllColumn"
  | "editor.selectEndColumn"
  | "editor.editTable"
  | "editor.editEndTable"
  | "editor.draggableColumn"
  | "editor.draggableEndColumn"
  | "editor.drawStartRelationship"
  | "editor.drawStartAddRelationship"
  | "editor.drawEndRelationship"
  | "editor.drawRelationship"
  | "editor.loadJson";

export type Command =
  | CommandEffect<null>
  | CommandEffect<AddTable>
  | CommandEffect<MoveTable>
  | CommandEffect<RemoveTable>
  | CommandEffect<SelectTable>
  | CommandEffect<ChangeTableValue>
  | CommandEffect<DragSelectTable>
  | CommandEffect<Array<AddColumn>>
  | CommandEffect<Array<AddCustomColumn>>
  | CommandEffect<RemoveColumn>
  | CommandEffect<ChangeColumnValue>
  | CommandEffect<ChangeColumnOption>
  | CommandEffect<MoveColumn>
  | CommandEffect<Array<ActiveColumn>>
  | CommandEffect<AddRelationship>
  | CommandEffect<RemoveRelationship>
  | CommandEffect<ChangeRelationshipType>
  | CommandEffect<ChangeIdentification>
  | CommandEffect<AddMemo>
  | CommandEffect<MoveMemo>
  | CommandEffect<RemoveMemo>
  | CommandEffect<SelectMemo>
  | CommandEffect<ChangeMemoValue>
  | CommandEffect<ResizeMemo>
  | CommandEffect<DragSelectMemo>
  | CommandEffect<MoveCanvas>
  | CommandEffect<ResizeCanvas>
  | CommandEffect<ChangeCanvasShow>
  | CommandEffect<ChangeDatabase>
  | CommandEffect<ChangeDatabaseName>
  | CommandEffect<ChangeCanvasType>
  | CommandEffect<ChangeLanguage>
  | CommandEffect<ChangeNameCase>
  | CommandEffect<FocusTable>
  | CommandEffect<FocusMoveTable>
  | CommandEffect<FocusTargetTable>
  | CommandEffect<FocusTargetColumn>
  | CommandEffect<EditTable>
  | CommandEffect<DraggableColumn>
  | CommandEffect<DrawStartRelationship>
  | CommandEffect<DrawStartAddRelationship>
  | CommandEffect<DrawRelationship>
  | CommandEffect<LoadJson>;

export function commandExecute(store: Store, commands: Command[]) {
  commands.forEach((command) => {
    switch (command.name) {
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
    }
  });
}
