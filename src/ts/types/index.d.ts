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
}
// export { Command, CommandType };
