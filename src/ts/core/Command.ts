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
} from "./command/table";
import {
  AddColumn,
  addColumnExecute,
  RemoveColumn,
  removeColumnExecute,
  ChangeColumnNotNull,
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
  | "column.add"
  | "column.remove"
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
  | "editor.editTable"
  | "editor.editEndTable";

export type Command =
  | CommandEffect<null>
  | CommandEffect<AddTable>
  | CommandEffect<MoveTable>
  | CommandEffect<RemoveTable>
  | CommandEffect<SelectTable>
  | CommandEffect<Array<AddColumn>>
  | CommandEffect<Array<RemoveColumn>>
  | CommandEffect<ChangeColumnNotNull>
  | CommandEffect<AddMemo>
  | CommandEffect<MoveMemo>
  | CommandEffect<RemoveMemo>
  | CommandEffect<SelectMemo>
  | CommandEffect<MoveCanvas>
  | CommandEffect<ResizeCanvas>
  | CommandEffect<FocusTable>
  | CommandEffect<FocusMoveTable>
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
      case "column.add":
        addColumnExecute(store, command.data as Array<AddColumn>);
        break;
      case "column.remove":
        removeColumnExecute(store, command.data as Array<RemoveColumn>);
        break;
      case "column.changeNotNull":
        changeColumnNotNullExecute(store, command.data as ChangeColumnNotNull);
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
      case "editor.editTable":
        editTableExecute(store, command.data as EditTable);
        break;
      case "editor.editEndTable":
        editEndTableExecute(store);
        break;
    }
  });
}
