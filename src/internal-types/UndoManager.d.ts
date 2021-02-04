export interface Command {
  undo(): void;
  redo(): void;
}

export type CommandKey = keyof Command;
