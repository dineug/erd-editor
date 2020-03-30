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
  pull(effect: (commands: Command[]) => void): Subscription;
  push(commands: Command[]): void;
}
