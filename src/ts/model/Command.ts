export type Command = CommandEffect<TableMove>;
type CommandName = "tableMove";

interface CommandEffect<T> {
  name: CommandName;
  effect: () => void;
  data: T;
}

interface TableMove {
  tableId: string;
  left: number;
  top: number;
}
export function tableMove(
  data: TableMove,
  effect = () => {}
): CommandEffect<TableMove> {
  return {
    name: "tableMove",
    effect,
    data
  };
}
