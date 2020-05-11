import { Store } from "./Store";
import { UndoManager } from "./UndoManager";
import { Command, CommandType } from "./Command";
import { Logger } from "./Logger";
import {
  AddTable,
  MoveTable,
  RemoveTable,
  ChangeTableValue,
  LoadTable,
  removeTable,
} from "./command/table";
import {
  AddColumn,
  AddCustomColumn,
  RemoveColumn,
  ChangeColumnValue,
  ChangeColumnOption,
  MoveColumn,
} from "./command/column";
import {
  AddRelationship,
  RemoveRelationship,
  ChangeRelationshipType,
  ChangeIdentification,
} from "./command/relationship";
import {
  AddMemo,
  MoveMemo,
  RemoveMemo,
  ChangeMemoValue,
  ResizeMemo,
} from "./command/memo";
import {
  MoveCanvas,
  ResizeCanvas,
  ChangeCanvasShow,
  ChangeDatabase,
  ChangeDatabaseName,
  ChangeCanvasType,
  ChangeLanguage,
  ChangeNameCase,
} from "./command/canvas";
import { LoadJson } from "./command/editor";

export function executeUndoCommand(
  store: Store,
  undoManager: UndoManager,
  commands: Array<Command<CommandType>>
) {
  Logger.debug(
    `executeUndoCommand: ${commands.map((command) => command.type).join(", ")}`
  );
  const batchUndoCommand: Array<Command<CommandType>> = [];
  const batchRedoCommand: Array<Command<CommandType>> = [];
  commands.forEach((command) => {
    if (/^table\./.test(command.type)) {
      executeTableCommand(store, command, batchUndoCommand, batchRedoCommand);
    } else if (/^column\./.test(command.type)) {
      executeColumnCommand(store, command, batchUndoCommand, batchRedoCommand);
    } else if (/^relationship\./.test(command.type)) {
      executeRelationshipCommand(
        store,
        command,
        batchUndoCommand,
        batchRedoCommand
      );
    } else if (/^memo\./.test(command.type)) {
      executeMemoCommand(store, command, batchUndoCommand, batchRedoCommand);
    } else if (/^canvas\./.test(command.type)) {
      executeCanvasCommand(store, command, batchUndoCommand, batchRedoCommand);
    } else if (/^editor\./.test(command.type)) {
      executeEditorCommand(store, command, batchUndoCommand, batchRedoCommand);
    }
  });
  undoManager.add({
    undo() {
      store.undo$.next(batchUndoCommand);
    },
    redo() {
      store.undo$.next(batchRedoCommand);
    },
  });
}

function executeTableCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  // table.add - easy
  // table.move - easy
  // table.remove
  // table.changeName - easy
  // table.changeComment - easy
  // table.sort
  switch (command.type) {
    case "table.add":
      const data = command.data as AddTable;
      batchUndoCommand.push(removeTable(store, data.id));
      batchRedoCommand.push(command);
      break;
  }
}

function executeColumnCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  // column.add - easy
  // column.addCustom - easy
  // column.remove
  // column.changeName - easy
  // column.changeComment - easy
  // column.changeDataType - easy
  // column.changeDefault - easy
  // column.changeAutoIncrement - easy
  // column.changePrimaryKey - easy
  // column.changeUnique - easy
  // column.changeNotNull - easy
  // column.move
  switch (command.type) {
  }
}

function executeRelationshipCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  // relationship.add - easy
  // relationship.remove - easy
  // relationship.changeRelationshipType - easy
  // relationship.changeIdentification - easy
  switch (command.type) {
  }
}

function executeMemoCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  // memo.add - easy
  // memo.move - easy
  // memo.remove - easy
  // memo.changeValue - easy
  // memo.resize - easy
  switch (command.type) {
  }
}

function executeCanvasCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  // canvas.move - easy
  // canvas.resize - easy
  // canvas.changeShow - easy
  // canvas.changeDatabase - easy
  // canvas.changeDatabaseName - easy
  switch (command.type) {
  }
}

function executeEditorCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  // editor.loadJson - easy
  // editor.clear - easy
  switch (command.type) {
  }
}
