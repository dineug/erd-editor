import { Command } from "../Command";
import { Store } from "../Store";
import { Logger } from "../Logger";

export interface ShareMouse {
  x: number;
  y: number;
}
export function shareMouse(x: number, y: number): Command<"share.mouse"> {
  return {
    type: "share.mouse",
    data: {
      x,
      y,
    },
  };
}
export function executeShareMouse(store: Store, data: ShareMouse) {
  Logger.debug("executeShareMouse");
}
