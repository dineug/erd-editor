import { Store } from "./Store";
import {
  AddTable,
  addTableExecute,
  MoveTable,
  moveTableExecute,
  RemoveTable,
  removeTableExecute,
  SelectTable,
  selectTableExecute,
  selectEndTableExecute,
  selectAllTableExecute,
  ChangeTableValue,
  changeTableNameExecute,
  changeTableCommentExecute,
} from "./command/table";
import {
  AddColumn,
  addColumnExecute,
  RemoveColumn,
  removeColumnExecute,
  ChangeColumnValue,
  changeColumnNameExecute,
  changeColumnCommentExecute,
  changeColumnDataTypeExecute,
  changeColumnDefaultExecute,
  ChangeColumnOption,
  changeColumnAutoIncrementExecute,
  changeColumnPrimaryKeyExecute,
  changeColumnUniqueExecute,
  changeColumnNotNullExecute,
} from "./command/column";
import {
  AddMemo,
  addMemoExecute,
  MoveMemo,
  moveMemoExecute,
  RemoveMemo,
  removeMemoExecute,
  SelectMemo,
  selectMemoExecute,
  selectEndMemoExecute,
  selectAllMemoExecute,
} from "./command/memo";
import {
  MoveCanvas,
  moveCanvasExecute,
  ResizeCanvas,
  resizeCanvasExecute,
} from "./command/canvas";
import {
  FocusTable,
  focusTableExecute,
  focusEndTableExecute,
  FocusMoveTable,
  focusMoveTableExecute,
  FocusTargetTable,
  focusTargetTableExecute,
  FocusTargetColumn,
  focusTargetColumnExecute,
  selectAllColumnExecute,
  selectEndColumnExecute,
  EditTable,
  editTableExecute,
  editEndTableExecute,
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
  | "column.add"
  | "column.remove"
  | "column.changeName"
  | "column.changeComment"
  | "column.changeDataType"
  | "column.changeDefault"
  | "column.changeAutoIncrement"
  | "column.changePrimaryKey"
  | "column.changeUnique"
  | "column.changeNotNull"
  | "memo.add"
  | "memo.move"
  | "memo.remove"
  | "memo.select"
  | "memo.selectEnd"
  | "memo.selectAll"
  | "canvas.move"
  | "canvas.resize"
  | "editor.focusTable"
  | "editor.focusEndTable"
  | "editor.focusMoveTable"
  | "editor.focusTargetTable"
  | "editor.focusTargetColumn"
  | "editor.selectAllColumn"
  | "editor.selectEndColumn"
  | "editor.editTable"
  | "editor.editEndTable";

export type Command =
  | CommandEffect<null>
  | CommandEffect<AddTable>
  | CommandEffect<MoveTable>
  | CommandEffect<RemoveTable>
  | CommandEffect<SelectTable>
  | CommandEffect<ChangeTableValue>
  | CommandEffect<Array<AddColumn>>
  | CommandEffect<RemoveColumn>
  | CommandEffect<ChangeColumnValue>
  | CommandEffect<ChangeColumnOption>
  | CommandEffect<AddMemo>
  | CommandEffect<MoveMemo>
  | CommandEffect<RemoveMemo>
  | CommandEffect<SelectMemo>
  | CommandEffect<MoveCanvas>
  | CommandEffect<ResizeCanvas>
  | CommandEffect<FocusTable>
  | CommandEffect<FocusMoveTable>
  | CommandEffect<FocusTargetTable>
  | CommandEffect<FocusTargetColumn>
  | CommandEffect<EditTable>;

export function commandExecute(store: Store, commands: Command[]) {
  commands.forEach(command => {
    switch (command.name) {
      case "table.add":
        addTableExecute(store, command.data as AddTable);
        break;
      case "table.move":
        moveTableExecute(store, command.data as MoveTable);
        break;
      case "table.remove":
        removeTableExecute(store, command.data as RemoveTable);
        break;
      case "table.select":
        selectTableExecute(store, command.data as SelectTable);
        break;
      case "table.selectEnd":
        selectEndTableExecute(store);
        break;
      case "table.selectAll":
        selectAllTableExecute(store);
        break;
      case "table.changeName":
        changeTableNameExecute(store, command.data as ChangeTableValue);
        break;
      case "table.changeComment":
        changeTableCommentExecute(store, command.data as ChangeTableValue);
        break;
      case "column.add":
        addColumnExecute(store, command.data as Array<AddColumn>);
        break;
      case "column.remove":
        removeColumnExecute(store, command.data as RemoveColumn);
        break;
      case "column.changeName":
        changeColumnNameExecute(store, command.data as ChangeColumnValue);
        break;
      case "column.changeComment":
        changeColumnCommentExecute(store, command.data as ChangeColumnValue);
        break;
      case "column.changeDataType":
        changeColumnDataTypeExecute(store, command.data as ChangeColumnValue);
        break;
      case "column.changeDefault":
        changeColumnDefaultExecute(store, command.data as ChangeColumnValue);
        break;
      case "column.changeAutoIncrement":
        changeColumnAutoIncrementExecute(
          store,
          command.data as ChangeColumnOption
        );
        break;
      case "column.changePrimaryKey":
        changeColumnPrimaryKeyExecute(
          store,
          command.data as ChangeColumnOption
        );
        break;
      case "column.changeUnique":
        changeColumnUniqueExecute(store, command.data as ChangeColumnOption);
        break;
      case "column.changeNotNull":
        changeColumnNotNullExecute(store, command.data as ChangeColumnOption);
        break;
      case "memo.add":
        addMemoExecute(store, command.data as AddMemo);
        break;
      case "memo.move":
        moveMemoExecute(store, command.data as MoveMemo);
        break;
      case "memo.remove":
        removeMemoExecute(store, command.data as RemoveMemo);
        break;
      case "memo.select":
        selectMemoExecute(store, command.data as SelectMemo);
        break;
      case "memo.selectEnd":
        selectEndMemoExecute(store);
        break;
      case "memo.selectAll":
        selectAllMemoExecute(store);
        break;
      case "canvas.move":
        moveCanvasExecute(store, command.data as MoveCanvas);
        break;
      case "canvas.resize":
        resizeCanvasExecute(store, command.data as ResizeCanvas);
        break;
      case "editor.focusTable":
        focusTableExecute(store, command.data as FocusTable);
        break;
      case "editor.focusEndTable":
        focusEndTableExecute(store);
        break;
      case "editor.focusMoveTable":
        focusMoveTableExecute(store, command.data as FocusMoveTable);
        break;
      case "editor.focusTargetTable":
        focusTargetTableExecute(store, command.data as FocusTargetTable);
        break;
      case "editor.focusTargetColumn":
        focusTargetColumnExecute(store, command.data as FocusTargetColumn);
        break;
      case "editor.selectAllColumn":
        selectAllColumnExecute(store);
        break;
      case "editor.selectEndColumn":
        selectEndColumnExecute(store);
        break;
      case "editor.editTable":
        editTableExecute(store, command.data as EditTable);
        break;
      case "editor.editEndTable":
        editEndTableExecute(store);
        break;
    }
  });
}
