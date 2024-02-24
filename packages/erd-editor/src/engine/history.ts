import { AnyAction } from '@dineug/r-html';

type Dispatch = (actions: AnyAction[]) => void;

export type Command = {
  undo: (dispatch: Dispatch) => void;
  redo: (dispatch: Dispatch) => void;
};

export type CommandKey = keyof Command;

export type History = {
  readonly cursor: number;
  readonly size: number;
  hasUndo: () => boolean;
  hasRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  push: (command: Command) => void;
  clear: () => void;
  setLimit: (limit: number) => void;
  clone: (options: HistoryOptions) => History;
};

type HasHistory = {
  hasRedo: boolean;
  hasUndo: boolean;
};

export type HistoryOptions = {
  notify: (has: HasHistory) => void;
  dispatch: Dispatch;
};

type HistoryState = {
  commands: Command[];
  cursor: number;
  limit: number;
};

export function createHistory(
  { notify, dispatch }: HistoryOptions,
  initialState?: HistoryState
): History {
  let commands: Command[] = initialState?.commands ?? [];
  let cursor = initialState?.cursor ?? -1;
  let limit = initialState?.limit ?? 0;
  let executable = true;

  const hasUndo = () => cursor !== -1;
  const hasRedo = () => cursor < commands.length - 1;
  const setLimit = (newLimit: number) => (limit = newLimit);

  const getHas = (): HasHistory => ({
    hasRedo: hasRedo(),
    hasUndo: hasUndo(),
  });

  const execute = (command: Command, key: CommandKey) => {
    executable = false;
    command[key](dispatch);
    executable = true;
  };

  const push = (command: Command) => {
    if (!executable) return;

    commands.splice(cursor + 1, commands.length - cursor);
    commands.push(command);

    if (limit !== 0 && commands.length > limit) {
      commands = commands.slice(commands.length - limit, commands.length);
    }

    cursor = commands.length - 1;
    notify(getHas());
  };

  const undo = () => {
    if (!hasUndo()) return;

    const command = commands[cursor];
    execute(command, 'undo');
    cursor--;
    notify(getHas());
  };

  const redo = () => {
    if (!hasRedo()) return;

    const command = commands[cursor + 1];
    execute(command, 'redo');
    cursor++;
    notify(getHas());
  };

  const clear = () => {
    const prevSize = commands.length;
    commands = [];
    cursor = -1;
    prevSize > 0 && notify(getHas());
  };

  const clone = (options: HistoryOptions): History => {
    return createHistory(options, {
      commands: [...commands],
      cursor,
      limit,
    });
  };

  return {
    get cursor() {
      return cursor;
    },
    get size() {
      return commands.length;
    },
    hasUndo,
    hasRedo,
    push,
    undo,
    redo,
    clear,
    setLimit,
    clone,
  };
}
