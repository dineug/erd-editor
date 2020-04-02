import { LitElement } from "lit-element";
import { Subscription } from "rxjs";
import { EditorContext } from "../core/EditorContext";
import { Command } from "../core/Command";

export declare class Editor extends LitElement {
  context: EditorContext;
  width: number;
  height: number;
  focus(): void;
  blur(): void;
  subscribe(effect: (commands: Command[]) => void): Subscription;
  next(commands: Command[]): void;
}
