import { TableMove } from "./command/table";

export type Command = CommandEffect<TableMove>;
type CommandName = "table.move";

export interface CommandEffect<T> {
  name: CommandName;
  effect: () => void;
  data: T;
}
