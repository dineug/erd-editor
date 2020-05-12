interface Command {
  undo(): void;
  redo(): void;
}

type CommandKey = keyof Command;

export class UndoManager {
  private commands: Command[] = [];
  private index = -1;
  private limit = 0;
  private run = false;
  private effect: () => void;

  get hasUndo() {
    return this.index !== -1;
  }

  get hasRedo() {
    return this.index < this.commands.length - 1;
  }

  constructor(effect: () => void) {
    this.effect = effect;
  }

  add(command: Command) {
    if (this.run) return;

    this.commands.splice(this.index + 1, this.commands.length - this.index);
    this.commands.push(command);

    if (this.limit !== 0 && this.commands.length > this.limit) {
      this.commands = this.commands.slice(
        this.commands.length - this.limit,
        this.commands.length
      );
    }

    this.index = this.commands.length - 1;
    this.effect();
  }

  undo() {
    const command = this.commands[this.index];
    this.execute(command, "undo");
    this.index--;
    this.effect();
  }

  redo() {
    const command = this.commands[this.index + 1];
    this.execute(command, "redo");
    this.index++;
    this.effect();
  }

  clear() {
    const prevSize = this.commands.length;
    this.commands = [];
    this.index = -1;
    if (prevSize > 0) {
      this.effect();
    }
  }

  setLimit(limit: number) {
    this.limit = limit;
  }

  private execute(command: Command, key: CommandKey) {
    this.run = true;
    command[key]();
    this.run = false;
  }
}
