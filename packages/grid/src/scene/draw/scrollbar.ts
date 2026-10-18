import {
  type SceneLayout,
  type SceneRect,
  SCROLLBAR_SIZE,
} from '@/scene/layout';

/** The shortest a thumb draws, so a million rows still leave one to grab. */
export const MIN_THUMB_LENGTH = 24;

/** The gap between a thumb and the long sides of its track. */
export const THUMB_INSET = 2;

/** The thumb's rounding, half its thickness, so its ends are round. */
export const THUMB_RADIUS = (SCROLLBAR_SIZE - THUMB_INSET * 2) / 2;

/** One scrollbar: its track along the stage edge and the thumb inside it. */
export interface ScrollbarAxis {
  visible: boolean;
  track: SceneRect;
  thumb: SceneRect;
}

/** Both scrollbars, in stage coordinates. */
export interface Scrollbars {
  vertical: ScrollbarAxis;
  horizontal: ScrollbarAxis;
}

const NONE: SceneRect = Object.freeze({ x: 0, y: 0, width: 0, height: 0 });

const HIDDEN: ScrollbarAxis = Object.freeze({
  visible: false,
  track: NONE,
  thumb: NONE,
});

/**
 * Where a thumb starts and how long it is along a span: as long as the share
 * of the content in view, never under the minimum, and as far along as the
 * scroll offset is along its range.
 */
function thumbSpan(span: number, max: number, offset: number) {
  const length = Math.min(
    span,
    Math.max(MIN_THUMB_LENGTH, (span * span) / (span + max))
  );
  const start = max > 0 ? ((span - length) * offset) / max : 0;

  return { start, length };
}

/**
 * The scrollbars a layout shows at the scroll offsets given, in content
 * pixels. A track spans its stage edge, the vertical one through the corner
 * the two share, and its thumb travels the scrolling region beside it.
 */
export function scrollbars(
  layout: SceneLayout,
  scrollTop: number,
  scrollLeft: number
): Scrollbars {
  const { width, height, body } = layout;
  const thickness = SCROLLBAR_SIZE - THUMB_INSET * 2;
  let vertical = HIDDEN;
  let horizontal = HIDDEN;

  if (layout.verticalBar) {
    const x = width - SCROLLBAR_SIZE;
    const thumb = thumbSpan(body.height, layout.maxScrollTop, scrollTop);

    vertical = {
      visible: true,
      track: { x, y: 0, width: SCROLLBAR_SIZE, height },
      thumb: {
        x: x + THUMB_INSET,
        y: body.y + thumb.start,
        width: thickness,
        height: thumb.length,
      },
    };
  }

  if (layout.horizontalBar) {
    const y = height - SCROLLBAR_SIZE;
    const thumb = thumbSpan(body.width, layout.maxScrollLeft, scrollLeft);

    horizontal = {
      visible: true,
      track: {
        x: 0,
        y,
        width: width - (layout.verticalBar ? SCROLLBAR_SIZE : 0),
        height: SCROLLBAR_SIZE,
      },
      thumb: {
        x: body.x + thumb.start,
        y: y + THUMB_INSET,
        width: thumb.length,
        height: thickness,
      },
    };
  }

  return { vertical, horizontal };
}
