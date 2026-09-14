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

/**
 * How far a menu drawn at box moves into the window: back from the right and
 * bottom edges, never past the left and top. A submenu the right edge cuts
 * flips to end at flipRight instead, unless the left edge would cut it more.
 */
export function fitMenu(box: MenuBox, view: WindowSize, flipRight?: number) {
  let left = clampStart(box.left, box.width, view.width);

  if (!isNil(flipRight)) {
    const flipped = flipRight - box.width;
    const rightOverflow = box.left + box.width - view.width;
    left = rightOverflow > 0 && -flipped < rightOverflow ? flipped : box.left;
  }

  const top = clampStart(box.top, box.height, view.height);

  return { dx: whole(left - box.left), dy: whole(top - box.top) };
}
