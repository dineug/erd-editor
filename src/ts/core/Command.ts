import { Store } from "./Store";
import {
  AddTable,
  addTableExecute,
  MoveTable,
  moveTableExecute,
  RemoveTable,
  removeTableExecute,
  SelectTable,
  selectTableExecute
} from "./command/table";
import {
  AddColumn,
  addColumnExecute,
  RemoveColumn,
  removeColumnExecute
} from "./command/column";
import {
  AddMemo,
  addMemoExecute,
  MoveMemo,
  moveMemoExecute,
  RemoveMemo,
  removeMemoExecute,
  SelectMemo,
  selectMemoExecute
} from "./command/memo";

export interface CommandEffect<T> {
  name: CommandName;
  data: T;
}
type CommandName =
  | "table.add"
  | "table.move"
  | "table.remove"
  | "table.select"
  | "column.add"
  | "column.remove"
  | "memo.add"
  | "memo.move"
  | "memo.remove"
  | "memo.select";
export type Command =
  | CommandEffect<AddTable>
  | CommandEffect<MoveTable>
  | CommandEffect<RemoveTable>
  | CommandEffect<SelectTable>
  | CommandEffect<Array<AddColumn>>
  | CommandEffect<Array<RemoveColumn>>
  | CommandEffect<AddMemo>
  | CommandEffect<MoveMemo>
  | CommandEffect<RemoveMemo>
  | CommandEffect<SelectMemo>;

export function commandExecute(store: Store, command: Command) {
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
  }
}
