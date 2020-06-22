import { Store } from "./Store";
import { UndoManager } from "./UndoManager";
import { Command, CommandType } from "./Command";
import { Logger } from "./Logger";
import { createJsonStringify } from "./File";
import { getData, getIndex, cloneDeep } from "./Helper";
import { getColumn } from "./helper/ColumnHelper";
import { Relationship } from "./store/Relationship";
import { Column, Index } from "./store/Table";
import { LoadTable } from "./command/table";
import {
  AddTable,
  MoveTable,
  RemoveTable,
  ChangeTableValue,
  loadTable,
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
  loadColumn,
  removeOnlyColumn,
} from "./command/column";
import {
  AddRelationship,
  RemoveRelationship,
  ChangeRelationshipType,
  ChangeIdentification,
  removeRelationship,
  loadRelationship,
} from "./command/relationship";
import { removeIndex, loadIndex } from "./command/indexes";
import {
  AddMemo,
  MoveMemo,
  RemoveMemo,
  ChangeMemoValue,
  removeMemo,
  loadMemo,
} from "./command/memo";
import { ChangeCanvasShow, moveCanvas } from "./command/canvas";

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
  if (moveCanvasCommands.length === 1) {
    const { scrollTop, scrollLeft } = store.canvasState;
    const undoCommand = moveCanvasCommands[0] as Command<"canvas.move">;
    const redoCommand = moveCanvas(scrollTop, scrollLeft);
    if (
      Math.abs(undoCommand.data.scrollTop - scrollTop) +
        Math.abs(undoCommand.data.scrollLeft - scrollLeft) >
      50
    ) {
      batchUndoCommand.push(undoCommand);
      batchRedoCommand.push(redoCommand);
    }
  } else if (moveCanvasCommands.length > 1) {
    const undoCommand = moveCanvasCommands[0] as Command<"canvas.move">;
    const redoCommand = moveCanvasCommands[
      moveCanvasCommands.length - 1
    ] as Command<"canvas.move">;
    if (
      Math.abs(undoCommand.data.scrollTop - redoCommand.data.scrollTop) +
        Math.abs(undoCommand.data.scrollLeft - redoCommand.data.scrollLeft) >
      50
    ) {
      batchUndoCommand.push(undoCommand);
      batchRedoCommand.push(redoCommand);
    }
  }

  const moveTableCommands = commands.filter(
    (command) => command.type === "table.move"
  );
  if (moveTableCommands.length > 0) {
    const data = moveTableCommands[0].data as MoveTable;
    const tableIds = data.tableIds;
    const memoIds = data.memoIds;
    let movementX = 0;
    let movementY = 0;
    moveTableCommands.forEach((moveTableCommand) => {
      const data = moveTableCommand.data as MoveTable;
      movementX += data.movementX;
      movementY += data.movementY;
    });
    const undoCommand: Command<"table.move"> = {
      type: "table.move",
      data: {
        movementX: -1 * movementX,
        movementY: -1 * movementY,
        tableIds,
        memoIds,
      },
    };
    const redoCommand: Command<"table.move"> = {
      type: "table.move",
      data: {
        movementX,
        movementY,
        tableIds,
        memoIds,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(redoCommand);
  }

  const moveMemoCommands = commands.filter(
    (command) => command.type === "memo.move"
  );
  if (moveMemoCommands.length > 0) {
    const data = moveMemoCommands[0].data as MoveMemo;
    const tableIds = data.tableIds;
    const memoIds = data.memoIds;
    let movementX = 0;
    let movementY = 0;
    moveMemoCommands.forEach((moveTableCommand) => {
      const data = moveTableCommand.data as MoveMemo;
      movementX += data.movementX;
      movementY += data.movementY;
    });
    const undoCommand: Command<"memo.move"> = {
      type: "memo.move",
      data: {
        movementX: -1 * movementX,
        movementY: -1 * movementY,
        tableIds,
        memoIds,
      },
    };
    const redoCommand: Command<"memo.move"> = {
      type: "memo.move",
      data: {
        movementX,
        movementY,
        tableIds,
        memoIds,
      },
    };
    batchUndoCommand.push(undoCommand);
    batchRedoCommand.push(redoCommand);
  }

  if (batchUndoCommand.length && batchRedoCommand.length) {
    undoManager.add({
      undo() {
        store.undo$.next(batchUndoCommand);
      },
      redo() {
        store.undo$.next(batchRedoCommand);
      },
    });
  }
}

function executeTableCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  const { tables, indexes } = store.tableState;
  const { relationships } = store.relationshipState;
  if (command.type === "table.add" || command.type === "table.addOnly") {
    const data = command.data as AddTable;
    batchUndoCommand.push(removeTable(store, data.id));
    batchRedoCommand.push(command);
  } else if (command.type === "table.remove") {
    const data = command.data as RemoveTable;
    const undoTables: LoadTable[] = [];
    const undoRelationships: Relationship[] = [];
    const undoIndexes: Index[] = [];
    data.tableIds.forEach((tableId) => {
      const table = getData(tables, tableId);
      if (table) {
        undoTables.push(cloneDeep(table));
        relationships.forEach((relationship) => {
          const { start, end } = relationship;
          if (tableId === start.tableId || tableId === end.tableId) {
            undoRelationships.push(cloneDeep(relationship));
          }
        });
        const tableIndexes = indexes.filter(
          (index) => index.tableId === table.id
        );
        tableIndexes.forEach((index) => {
          undoIndexes.push(cloneDeep(index));
        });
      }
    });
    undoTables.forEach((table) => batchUndoCommand.push(loadTable(table)));
    if (undoRelationships.length > 0) {
      batchUndoCommand.push(
        removeRelationship(
          undoRelationships.map((relationship) => relationship.id)
        )
      );
      undoRelationships.forEach((relationship) => {
        batchUndoCommand.push(loadRelationship(relationship));
      });
    }
    if (undoIndexes.length > 0) {
      batchUndoCommand.push(removeIndex(undoIndexes.map((index) => index.id)));
      undoIndexes.forEach((index) => {
        batchUndoCommand.push(loadIndex(index));
      });
    }
    batchRedoCommand.push(command);
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
  } else if (command.type === "table.sort") {
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

function executeColumnCommand(
  store: Store,
  command: Command<CommandType>,
  batchUndoCommand: Array<Command<CommandType>>,
  batchRedoCommand: Array<Command<CommandType>>
) {
  const { tables, indexes } = store.tableState;
  const { relationships } = store.relationshipState;
  if (command.type === "column.add" || command.type === "column.addOnly") {
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
    const data = command.data as RemoveColumn;
    const undoRelationships: Relationship[] = [];
    const undoIndexes: Index[] = [];
    const table = getData(tables, data.tableId);
    if (table) {
      relationships.forEach((relationship) => {
        const { start, end } = relationship;
        if (
          (data.tableId === start.tableId &&
            data.columnIds.some((columnId) =>
              start.columnIds.some((id) => id === columnId)
            )) ||
          (data.tableId === end.tableId &&
            data.columnIds.some((columnId) =>
              end.columnIds.some((id) => id === columnId)
            ))
        ) {
          undoRelationships.push(cloneDeep(relationship));
        }
      });

      const tableIndexes = indexes.filter(
        (index) => index.tableId === table.id
      );
      tableIndexes.forEach((index) => {
        undoIndexes.push(cloneDeep(index));
      });

      const columns: Column[] = [];
      const indexList: number[] = [];
      data.columnIds.forEach((columnId) => {
        const column = getData(table.columns, columnId);
        const index = getIndex(table.columns, columnId);
        if (column && index !== null) {
          columns.push(cloneDeep(column));
          indexList.push(index);
        }
      });
      batchUndoCommand.push(loadColumn(data.tableId, columns, indexList));
      if (undoRelationships.length > 0) {
        batchUndoCommand.push(
          removeRelationship(
            undoRelationships.map((relationship) => relationship.id)
          )
        );
        undoRelationships.forEach((relationship) => {
          batchUndoCommand.push(loadRelationship(relationship));
        });
      }
      if (undoIndexes.length > 0) {
        batchUndoCommand.push(
          removeIndex(undoIndexes.map((index) => index.id))
        );
        undoIndexes.forEach((index) => {
          batchUndoCommand.push(loadIndex(index));
        });
      }
      batchRedoCommand.push(command);
    }
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
    const data = command.data as MoveColumn;
    const currentTable = getData(tables, data.tableId);
    const currentColumns: Column[] = [];
    data.columnIds.forEach((columnId) => {
      const column = getColumn(tables, data.tableId, columnId);
      if (column) {
        currentColumns.push(column);
      }
    });
    const targetTable = getData(tables, data.targetTableId);
    const targetColumn = getColumn(
      tables,
      data.targetTableId,
      data.targetColumnId
    );
    if (
      currentTable &&
      targetTable &&
      currentColumns.length !== 0 &&
      targetColumn
    ) {
      if (
        data.tableId === data.targetTableId &&
        !data.columnIds.some((columnId) => columnId === data.targetColumnId)
      ) {
        const columns: Column[] = [];
        const indexList: number[] = [];
        data.columnIds.forEach((columnId) => {
          const column = getData(currentTable.columns, columnId);
          const index = getIndex(currentTable.columns, columnId);
          if (column && index !== null) {
            columns.push(cloneDeep(column));
            indexList.push(index);
          }
        });
        batchUndoCommand.push(
          removeOnlyColumn(data.tableId, data.columnIds),
          loadColumn(data.tableId, columns, indexList)
        );
        batchRedoCommand.push(command);
      } else if (
        data.tableId !== data.targetTableId &&
        !data.columnIds.some((columnId) => columnId === data.targetColumnId)
      ) {
        const undoRelationships: Relationship[] = [];
        const columns: Column[] = [];
        const indexList: number[] = [];
        data.columnIds.forEach((columnId) => {
          const column = getData(currentTable.columns, columnId);
          const index = getIndex(currentTable.columns, columnId);
          if (column && index !== null) {
            columns.push(cloneDeep(column));
            indexList.push(index);
          }
        });
        batchUndoCommand.push(
          removeOnlyColumn(data.targetTableId, data.columnIds),
          loadColumn(data.tableId, columns, indexList)
        );
        relationships.forEach((relationship) => {
          const { start, end } = relationship;
          if (
            (data.tableId === start.tableId &&
              data.columnIds.some((columnId) =>
                start.columnIds.some((id) => id === columnId)
              )) ||
            (data.tableId === end.tableId &&
              data.columnIds.some((columnId) =>
                end.columnIds.some((id) => id === columnId)
              ))
          ) {
            undoRelationships.push(cloneDeep(relationship));
          }
        });
        if (undoRelationships.length > 0) {
          batchUndoCommand.push(
            removeRelationship(
              undoRelationships.map((relationship) => relationship.id)
            )
          );
          undoRelationships.forEach((relationship) => {
            batchUndoCommand.push(loadRelationship(relationship));
          });
        }
        batchRedoCommand.push(command);
      }
    }
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
        batchUndoCommand.push(loadRelationship(cloneDeep(relationship)));
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
  if (command.type === "memo.add" || command.type === "memo.addOnly") {
    const data = command.data as AddMemo;
    batchUndoCommand.push(removeMemo(store, data.id));
    batchRedoCommand.push(command);
  } else if (command.type === "memo.remove") {
    const data = command.data as RemoveMemo;
    data.memoIds.forEach((memoId) => {
      const memo = getData(memos, memoId);
      if (memo) {
        batchUndoCommand.push(loadMemo(cloneDeep(memo)));
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
