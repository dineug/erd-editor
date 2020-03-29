import { Store } from "./Store";
import {
  AddTable,
  addTableExecute,
  MoveTable,
  moveTableExecute,
  RemoveTable,
  removeTableExecute
} from "./command/table";
import { AddColumn, addColumnExecute } from "./command/column";

export type Command =
  | CommandEffect<AddTable>
  | CommandEffect<MoveTable>
  | CommandEffect<RemoveTable>
  | CommandEffect<Array<AddColumn>>;
type CommandName = "table.add" | "table.move" | "table.remove" | "column.add";

export interface CommandEffect<T> {
  name: CommandName;
  data: T;
}

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
    case "column.add":
      addColumnExecute(store, command.data as Array<AddColumn>);
      break;
  }
}
