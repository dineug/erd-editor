import { Command, CommandType, User } from "./Command";
import { AddTable } from "./command/table";
import { AddMemo } from "./command/memo";

export function executeShareCommand(
  commands: Array<Command<CommandType>>,
  user: User
): Array<Command<CommandType>> {
  const shareCommands: Array<Command<CommandType>> = [];
  commands.forEach((command) => {
    if (command.type === "table.add") {
      const data = Object.assign({}, command.data) as AddTable;
      data.ui.active = false;
      shareCommands.push({
        type: "table.addOnly",
        data,
        user: Object.assign({}, user),
      });
    } else if (command.type === "memo.add") {
      const data = Object.assign({}, command.data) as AddMemo;
      data.ui.active = false;
      shareCommands.push({
        type: "memo.addOnly",
        data,
        user: Object.assign({}, user),
      });
    } else if (command.type === "column.add") {
      shareCommands.push({
        type: "column.addOnly",
        data: command.data,
        user: Object.assign({}, user),
      });
    } else {
      shareCommands.push({
        type: command.type,
        data: command.data,
        user: Object.assign({}, user),
      });
    }
  });
  return shareCommands;
}
