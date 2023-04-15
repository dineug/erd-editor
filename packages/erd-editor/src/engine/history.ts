export type Command = {
  undo(): void;
  redo(): void;
};

export type CommandKey = keyof Command;

export type History = {
  hasUndo(): boolean;
  hasRedo(): boolean;
  undo(): void;
  redo(): void;
  push(command: Command): void;
  clear(): void;
  setLimit(limit: number): void;
};

type HasHistory = {
  hasRedo: boolean;
  hasUndo: boolean;
};

export function createHistory(notify: (has: HasHistory) => void): History {
  let commands: Command[] = [];
  let index = -1;
  let limit = 0;
  let executable = true;

  const hasUndo = () => index !== -1;
  const hasRedo = () => index < commands.length - 1;
  const setLimit = (newLimit: number) => (limit = newLimit);

  const getHas = (): HasHistory => ({
    hasRedo: hasRedo(),
    hasUndo: hasUndo(),
  });

  const execute = (command: Command, key: CommandKey) => {
    executable = false;
    command[key]();
    executable = true;
  };

  const push = (command: Command) => {
    if (!executable) return;

    commands.splice(index + 1, commands.length - index);
    commands.push(command);

    if (limit !== 0 && commands.length > limit) {
      commands = commands.slice(commands.length - limit, commands.length);
    }

    index = commands.length - 1;
    notify(getHas());
  };

  const undo = () => {
    if (!hasUndo()) return;

    const command = commands[index];
    execute(command, 'undo');
    index--;
    notify(getHas());
  };

  const redo = () => {
    if (!hasRedo()) return;

    const command = commands[index + 1];
    execute(command, 'redo');
    index++;
    notify(getHas());
  };

  const clear = () => {
    const prevSize = commands.length;
    commands = [];
    index = -1;
    prevSize > 0 && notify(getHas());
  };

  return {
    hasUndo,
    hasRedo,
    push,
    undo,
    redo,
    clear,
    setLimit,
  };
}
