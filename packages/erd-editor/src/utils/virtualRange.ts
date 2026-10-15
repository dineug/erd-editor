/** How many rows a virtual list draws past each edge of its view, so a short scroll finds them drawn already. */
export const VIRTUAL_OVERSCAN = 8;

/** The rows a list renders, first to last, both included; none while last is below first. */
export type VirtualRange = { first: number; last: number };

/**
 * The rows the screen shows at a scroll offset, with the overscan either side,
 * so a short scroll finds its rows drawn already.
 */
export function visibleRange(
  count: number,
  scrollTop: number,
  height: number,
  rowHeight: number
): VirtualRange {
  if (count === 0) return { first: 0, last: -1 };

  const first = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - VIRTUAL_OVERSCAN
  );
  const last = Math.min(
    count - 1,
    Math.ceil((scrollTop + height) / rowHeight) - 1 + VIRTUAL_OVERSCAN
  );
  return { first, last: Math.max(first - 1, last) };
}

/**
 * The scroll offset nearest the one given that shows a row whole: the same
 * while it shows, else the row's top or bottom at the edge it is past.
 */
export function offsetToShow(
  index: number,
  scrollTop: number,
  height: number,
  rowHeight: number
): number {
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + height) return Math.max(0, bottom - height);
  return scrollTop;
}
