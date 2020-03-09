import { Store } from "./Store";
import {
  TableAdd,
  tableAddExecute,
  TableMove,
  tableMoveExecute
} from "./command/table";

export type Command = CommandEffect<TableAdd> | CommandEffect<TableMove>;
type CommandName = "table.add" | "table.move";

export interface CommandEffect<T> {
  name: CommandName;
  data: T;
}

export function commandExecute(store: Store, command: Command) {
  switch (command.name) {
    case "table.add":
      tableAddExecute(store, command.data as TableAdd);
      break;
    case "table.move":
      tableMoveExecute(store, command.data as TableMove);
      break;
  }
}
