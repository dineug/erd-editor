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

export interface ResizeCanvas {
  width: number;
  height: number;
}
export function resizeCanvas(
  width: number,
  height: number
): CommandEffect<ResizeCanvas> {
  return {
    name: "canvas.resize",
    data: {
      width,
      height
    }
  };
}
export function resizeCanvasExecute(store: Store, data: ResizeCanvas) {
  const { canvasState } = store;
  canvasState.width = data.width;
  canvasState.height = data.height;
}
