import { isNil } from 'es-toolkit';

export type MenuBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type WindowSize = {
  width: number;
  height: number;
};

/** Rounded away from zero, so an edge moved in never ends a fraction outside. */
const whole = (value: number) =>
  value < 0 ? Math.floor(value) : Math.ceil(value);

const clampStart = (start: number, size: number, end: number) =>
  Math.max(0, Math.min(start, end - size));

const flipStart = (
  box: MenuBox,
  viewWidth: number,
  flipRight: number,
  openLeft: boolean
) => {
  const flipped = flipRight - box.width;
  const leftOverflow = -flipped;
  const rightOverflow = box.left + box.width - viewWidth;

  if (openLeft) {
    return leftOverflow > 0 && rightOverflow < leftOverflow
      ? box.left
      : flipped;
  }
  return rightOverflow > 0 && leftOverflow < rightOverflow ? flipped : box.left;
};

/**
 * How far a menu drawn at box moves into the window, never past its left and
 * top. A submenu opens right of its row, or left to end at flipRight for a
 * right-to-left reader, and switches only when its side cuts it more.
 */
export function fitMenu(
  box: MenuBox,
  view: WindowSize,
  flipRight?: number,
  openLeft = false
) {
  const left = isNil(flipRight)
    ? clampStart(box.left, box.width, view.width)
    : flipStart(box, view.width, flipRight, openLeft);
  const top = clampStart(box.top, box.height, view.height);

  return { dx: whole(left - box.left), dy: whole(top - box.top) };
}
