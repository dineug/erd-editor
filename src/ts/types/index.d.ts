import { LitElement } from "lit-element";
import { Subscription } from "rxjs";
import { EditorContext } from "../core/EditorContext";
import { Command, CommandType } from "../core/Command";

export declare class Editor extends LitElement {
  context: EditorContext;
  width: number;
  height: number;
  focus(): void;
  blur(): void;
  subscribe(effect: (commands: Command<CommandType>[]) => void): Subscription;
  next(commands: Command<CommandType>[]): void;
}
export { Command, CommandType };
