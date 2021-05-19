import { Command, CommandKey, History } from '@/internal-types/history';

export function createHistory(effect: () => void): History {
  let commands: Command[] = [];
  let index = -1;
  let limit = 0;
  let run = false;

  const hasUndo = () => index !== -1;
  const hasRedo = () => index < commands.length - 1;
  const setLimit = (newLimit: number) => (limit = newLimit);

  const execute = (command: Command, key: CommandKey) => {
    run = true;
    command[key]();
    run = false;
  };

  const push = (command: Command) => {
    if (run) return;

    commands.splice(index + 1, commands.length - index);
    commands.push(command);

    if (limit !== 0 && commands.length > limit) {
      commands = commands.slice(commands.length - limit, commands.length);
    }

    index = commands.length - 1;
    effect();
  };

  const undo = () => {
    if (!hasUndo()) return;

    const command = commands[index];
    execute(command, 'undo');
    index--;
    effect();
  };

  const redo = () => {
    if (!hasRedo()) return;

    const command = commands[index + 1];
    execute(command, 'redo');
    index++;
    effect();
  };

  const clear = () => {
    const prevSize = commands.length;
    commands = [];
    index = -1;
    prevSize > 0 && effect();
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
