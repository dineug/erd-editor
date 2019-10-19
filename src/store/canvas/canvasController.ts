import { State, CanvasType } from "../canvas";
import { log } from "@/ts/util";

export function canvasMove(
  state: State,
  payload: { scrollTop: number; scrollLeft: number }
) {
  // log.debug('canvasController canvasMove')
  const { scrollTop, scrollLeft } = payload;
  state.scrollTop = scrollTop;
  state.scrollLeft = scrollLeft;
}

export function canvasChangeType(state: State, canvasType: CanvasType) {
  log.debug("canvasController canvasChangeType");
  state.canvasType = canvasType;
}

export function canvasResize(
  state: State,
  payload: { width: number; height: number }
) {
  log.debug("canvasController canvasWidthHeight");
  const { width, height } = payload;
  state.width = width;
  state.height = height;
}
