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
  TableFocus,
  tableFocusExecute,
  tableFocusEndExecute,
  TableEdit,
  tableEditExecute,
  tableEditEndExecute,
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
  | "memo.add"
  | "memo.move"
  | "memo.remove"
  | "memo.select"
  | "memo.selectEnd"
  | "memo.selectAll"
  | "canvas.move"
  | "canvas.resize"
  | "editor.tableFocus"
  | "editor.tableFocusEnd"
  | "editor.tableEdit"
  | "editor.tableEditEnd";

export type Command =
  | CommandEffect<null>
  | CommandEffect<AddTable>
  | CommandEffect<MoveTable>
  | CommandEffect<RemoveTable>
  | CommandEffect<SelectTable>
  | CommandEffect<Array<AddColumn>>
  | CommandEffect<Array<RemoveColumn>>
  | CommandEffect<AddMemo>
  | CommandEffect<MoveMemo>
  | CommandEffect<RemoveMemo>
  | CommandEffect<SelectMemo>
  | CommandEffect<MoveCanvas>
  | CommandEffect<ResizeCanvas>
  | CommandEffect<TableFocus>
  | CommandEffect<TableEdit>;

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
      case "editor.tableFocus":
        tableFocusExecute(store, command.data as TableFocus);
        break;
      case "editor.tableFocusEnd":
        tableFocusEndExecute(store);
        break;
      case "editor.tableEdit":
        tableEditExecute(store, command.data as TableEdit);
        break;
      case "editor.tableEditEnd":
        tableEditEndExecute(store);
        break;
    }
  });
}
