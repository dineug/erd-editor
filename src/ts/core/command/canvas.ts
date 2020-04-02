import { CommandEffect } from "../Command";
import { Store } from "../Store";
import { Logger } from "../Logger";

export interface MoveCanvas {
  scrollTop: number;
  scrollLeft: number;
}
export function moveCanvas(
  scrollTop: number,
  scrollLeft: number
): CommandEffect<MoveCanvas> {
  return {
    name: "canvas.move",
    data: {
      scrollTop,
      scrollLeft
    }
  };
}
export function moveCanvasExecute(store: Store, data: MoveCanvas) {
  Logger.debug("moveCanvasExecute");
  const { canvasState } = store;
  canvasState.scrollTop = data.scrollTop;
  canvasState.scrollLeft = data.scrollLeft;
}
