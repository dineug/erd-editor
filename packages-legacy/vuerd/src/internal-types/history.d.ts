export interface Command {
  undo(): void;
  redo(): void;
}

export type CommandKey = keyof Command;

export interface History extends Command {
  hasUndo(): boolean;
  hasRedo(): boolean;
  push(command: Command): void;
  clear(): void;
  setLimit(limit: number): void;
}
