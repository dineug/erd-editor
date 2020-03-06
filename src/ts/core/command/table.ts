import { CommandEffect } from "../Command";

export interface TableMove {
  movementX: number;
  movementY: number;
  tableIds: string[];
  memoIds: string[];
}
export function tableMove(
  data: TableMove,
  effect = () => {}
): CommandEffect<TableMove> {
  return {
    name: "table.move",
    effect,
    data
  };
}
