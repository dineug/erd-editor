import { Store } from "./Store";
import { UndoManager } from "./UndoManager";
import { Command, CommandType } from "./Command";
import { Logger } from "./Logger";
import { createJsonStringify } from "./File";
import { getData } from "./Helper";
import { getColumn } from "./helper/ColumnHelper";
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
  removeColumn,
} from "./command/column";
import {
  AddRelationship,
  RemoveRelationship,
  ChangeRelationshipType,
  ChangeIdentification,
  removeRelationship,
  loadRelationship,
} from "./command/relationship";
import {
  AddMemo,
  MoveMemo,
  RemoveMemo,
  ChangeMemoValue,
  removeMemo,
  loadMemo,
} from "./command/memo";
import { ChangeCanvasShow } from "./command/canvas";

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
  const { memos } = store.memoState;
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

  const resizeMemoCommands = commands.filter(
    (command) => command.type === "memo.resize"
  );
  if (resizeMemoCommands.length > 1) {
    const undoCommand = resizeMemoCommands[0];
    const redoCommand = resizeMemoCommands[resizeMemoCommands.length - 1];
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(redoCommand);
  }

  const moveCanvasCommands = commands.filter(
    (command) => command.type === "canvas.move"
  );
  if (moveCanvasCommands.length > 1) {
    const undoCommand = moveCanvasCommands[0];
    const redoCommand = moveCanvasCommands[moveCanvasCommands.length - 1];
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(redoCommand);
  }

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
  const { tables } = store.tableState;
  // table.remove
  if (command.type === "table.add") {
    const data = command.data as AddTable;
    batchUndoCommand.push(removeTable(store, data.id));
    batchRedoCommand.push(command);
  } else if (command.type === "table.move") {
    const data = command.data as MoveTable;
    const undoCommand: Command<"table.move"> = {
      type: "table.move",
      data: {
        movementX: -1 * data.movementX,
        movementY: -1 * data.movementY,
        tableIds: data.tableIds,
        memoIds: data.memoIds,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  } else if (command.type === "table.remove") {
    // TODO: table, column, relationship
  } else if (command.type === "table.changeName") {
    const data = command.data as ChangeTableValue;
    const table = getData(tables, data.tableId);
    if (table) {
      const undoCommand: Command<"table.changeName"> = {
        type: "table.changeName",
        data: {
          tableId: data.tableId,
          value: table.name,
          width: table.ui.widthName,
        },
      };
      batchUndoCommand.push(undoCommand);
      batchRedoCommand.push(command);
    }
  } else if (command.type === "table.changeComment") {
    const data = command.data as ChangeTableValue;
    const table = getData(tables, data.tableId);
    if (table) {
      const undoCommand: Command<"table.changeComment"> = {
        type: "table.changeComment",
        data: {
          tableId: data.tableId,
          value: table.comment,
          width: table.ui.widthComment,
        },
      };
      batchUndoCommand.push(undoCommand);
      batchRedoCommand.push(command);
    }
  }
}

function executeColumnCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  const { tables } = store.tableState;
  // column.remove
  // column.move
  if (command.type === "column.add") {
    const data = command.data as Array<AddColumn>;
    data.forEach((addColumn) =>
      batchUndoCommand.push(removeColumn(addColumn.tableId, [addColumn.id]))
    );
    batchRedoCommand.push(command);
  } else if (command.type === "column.addCustom") {
    const data = command.data as Array<AddCustomColumn>;
    data.forEach((addColumn) =>
      batchUndoCommand.push(removeColumn(addColumn.tableId, [addColumn.id]))
    );
    batchRedoCommand.push(command);
  } else if (command.type === "column.remove") {
    // TODO: table, column, relationship
  } else if (command.type === "column.changeName") {
    const data = command.data as ChangeColumnValue;
    const column = getColumn(tables, data.tableId, data.columnId);
    if (column) {
      const undoCommand: Command<"column.changeName"> = {
        type: "column.changeName",
        data: {
          tableId: data.tableId,
          columnId: data.columnId,
          value: column.name,
          width: column.ui.widthName,
        },
      };
      batchUndoCommand.push(undoCommand);
      batchRedoCommand.push(command);
    }
  } else if (command.type === "column.changeComment") {
    const data = command.data as ChangeColumnValue;
    const column = getColumn(tables, data.tableId, data.columnId);
    if (column) {
      const undoCommand: Command<"column.changeComment"> = {
        type: "column.changeComment",
        data: {
          tableId: data.tableId,
          columnId: data.columnId,
          value: column.comment,
          width: column.ui.widthComment,
        },
      };
      batchUndoCommand.push(undoCommand);
      batchRedoCommand.push(command);
    }
  } else if (command.type === "column.changeDataType") {
    const data = command.data as ChangeColumnValue;
    const column = getColumn(tables, data.tableId, data.columnId);
    if (column) {
      const undoCommand: Command<"column.changeDataType"> = {
        type: "column.changeDataType",
        data: {
          tableId: data.tableId,
          columnId: data.columnId,
          value: column.dataType,
          width: column.ui.widthDataType,
        },
      };
      batchUndoCommand.push(undoCommand);
      batchRedoCommand.push(command);
    }
  } else if (command.type === "column.changeDefault") {
    const data = command.data as ChangeColumnValue;
    const column = getColumn(tables, data.tableId, data.columnId);
    if (column) {
      const undoCommand: Command<"column.changeDefault"> = {
        type: "column.changeDefault",
        data: {
          tableId: data.tableId,
          columnId: data.columnId,
          value: column.default,
          width: column.ui.widthDefault,
        },
      };
      batchUndoCommand.push(undoCommand);
      batchRedoCommand.push(command);
    }
  } else if (command.type === "column.changeAutoIncrement") {
    const data = command.data as ChangeColumnOption;
    const undoCommand: Command<"column.changeAutoIncrement"> = {
      type: "column.changeAutoIncrement",
      data: {
        tableId: data.tableId,
        columnId: data.columnId,
        value: !data.value,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  } else if (command.type === "column.changePrimaryKey") {
    const data = command.data as ChangeColumnOption;
    const undoCommand: Command<"column.changePrimaryKey"> = {
      type: "column.changePrimaryKey",
      data: {
        tableId: data.tableId,
        columnId: data.columnId,
        value: !data.value,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  } else if (command.type === "column.changeUnique") {
    const data = command.data as ChangeColumnOption;
    const undoCommand: Command<"column.changeUnique"> = {
      type: "column.changeUnique",
      data: {
        tableId: data.tableId,
        columnId: data.columnId,
        value: !data.value,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  } else if (command.type === "column.changeNotNull") {
    const data = command.data as ChangeColumnOption;
    const undoCommand: Command<"column.changeNotNull"> = {
      type: "column.changeNotNull",
      data: {
        tableId: data.tableId,
        columnId: data.columnId,
        value: !data.value,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  } else if (command.type === "column.move") {
    // TODO: table, column, relationship
  }
}

function executeRelationshipCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  const { relationships } = store.relationshipState;
  if (command.type === "relationship.add") {
    const data = command.data as AddRelationship;
    batchUndoCommand.push(removeRelationship([data.id]));
    batchRedoCommand.push(command);
  } else if (command.type === "relationship.remove") {
    const data = command.data as RemoveRelationship;
    data.relationshipIds.forEach((relationshipId) => {
      const relationship = getData(relationships, relationshipId);
      if (relationship) {
        batchUndoCommand.push(loadRelationship(relationship));
      }
    });
    batchRedoCommand.push(command);
  } else if (command.type === "relationship.changeRelationshipType") {
    const data = command.data as ChangeRelationshipType;
    const relationship = getData(relationships, data.relationshipId);
    if (relationship) {
      const undoCommand: Command<"relationship.changeRelationshipType"> = {
        type: "relationship.changeRelationshipType",
        data: {
          relationshipId: data.relationshipId,
          relationshipType: relationship.relationshipType,
        },
      };
      batchUndoCommand.push(undoCommand);
      batchRedoCommand.push(command);
    }
  } else if (command.type === "relationship.changeIdentification") {
    const data = command.data as ChangeIdentification;
    const undoCommand: Command<"relationship.changeIdentification"> = {
      type: "relationship.changeIdentification",
      data: {
        relationshipId: data.relationshipId,
        identification: !data.identification,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  }
}

function executeMemoCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  const { memos } = store.memoState;
  if (command.type === "memo.add") {
    const data = command.data as AddMemo;
    batchUndoCommand.push(removeMemo(store, data.id));
    batchRedoCommand.push(command);
  } else if (command.type === "memo.move") {
    const data = command.data as MoveMemo;
    const undoCommand: Command<"memo.move"> = {
      type: "memo.move",
      data: {
        movementX: -1 * data.movementX,
        movementY: -1 * data.movementY,
        tableIds: data.tableIds,
        memoIds: data.memoIds,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  } else if (command.type === "memo.remove") {
    const data = command.data as RemoveMemo;
    data.memoIds.forEach((memoId) => {
      const memo = getData(memos, memoId);
      if (memo) {
        batchUndoCommand.push(loadMemo(memo));
      }
    });
    batchRedoCommand.push(command);
  } else if (command.type === "memo.changeValue") {
    const data = command.data as ChangeMemoValue;
    const memo = getData(memos, data.memoId);
    if (memo) {
      const undoCommand: Command<"memo.changeValue"> = {
        type: "memo.changeValue",
        data: {
          memoId: data.memoId,
          value: memo.value,
        },
      };
      batchUndoCommand.push(undoCommand);
      batchRedoCommand.push(command);
    }
  }
}

function executeCanvasCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  const { width, height, database, databaseName } = store.canvasState;
  if (command.type === "canvas.resize") {
    const undoCommand: Command<"canvas.resize"> = {
      type: "canvas.resize",
      data: {
        width,
        height,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  } else if (command.type === "canvas.changeShow") {
    const data = command.data as ChangeCanvasShow;
    const undoCommand: Command<"canvas.changeShow"> = {
      type: "canvas.changeShow",
      data: {
        showKey: data.showKey,
        value: !data.value,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  } else if (command.type === "canvas.changeDatabase") {
    const undoCommand: Command<"canvas.changeDatabase"> = {
      type: "canvas.changeDatabase",
      data: {
        database,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  } else if (command.type === "canvas.changeDatabaseName") {
    const undoCommand: Command<"canvas.changeDatabaseName"> = {
      type: "canvas.changeDatabaseName",
      data: {
        value: databaseName,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  }
}

function executeEditorCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  if (command.type === "editor.loadJson") {
    const undoCommand: Command<"editor.loadJson"> = {
      type: "editor.loadJson",
      data: {
        value: createJsonStringify(store),
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  } else if (command.type === "editor.clear") {
    const undoCommand: Command<"editor.loadJson"> = {
      type: "editor.loadJson",
      data: {
        value: createJsonStringify(store),
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(command);
  }
}
