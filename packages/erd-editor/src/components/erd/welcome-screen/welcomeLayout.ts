import type { RootState } from '@/engine/state';
import type { TextDirection } from '@/i18n/locales';
import { hasContent } from '@/konva/scene/contentBounds';
import { editorRootOf } from '@/utils/domEvent';

/** The narrowest canvas that shows the welcome screen at all. */
export const WELCOME_MIN_WIDTH = 320;

/**
 * The least height that shows the heading over the menu: a heading of two
 * lines over the six rows of Import's formats, clear of the floating toolbar.
 */
export const WELCOME_FULL_MIN_HEIGHT = 342;

/** The least height that shows the menu alone: Import's six rows, clear of the floating toolbar. */
export const WELCOME_MENU_MIN_HEIGHT = 294;

/**
 * The least canvas the hints at the tools take room on, beside the centre
 * block: the height keeps them clear of the block, Import's formats in it, in
 * the language whose labels wrap the most.
 */
export const WELCOME_HINTS_MIN_WIDTH = 720;
export const WELCOME_HINTS_MIN_HEIGHT = 562;

/** The widest a hint's label runs before it wraps, as WelcomeHints.styles.ts sets it. */
export const HINT_LABEL_MAX_WIDTH = 220;

/** How far a label stands from its arrow beside it. */
const HINT_GAP = 4;

/** The narrowest canvas whose menu rows still show their chords. */
export const WELCOME_KBD_MIN_WIDTH = 480;

/** The arrow that climbs to a toolbar button: its box, and its tip near the top right. */
export const ARROW_UP_BOX = {
  width: 44,
  height: 72,
  tipX: 36,
  tipY: 3,
} as const;

/** The arrow that drops to the floating toolbar: its box, and its tip at the bottom middle. */
export const ARROW_DOWN_BOX = {
  width: 40,
  height: 56,
  tipX: 20,
  tipY: 53,
} as const;

export type WelcomeCenter = 'full' | 'menu' | 'none';

/** What the room on the canvas lets the welcome screen show. */
export type WelcomeTiers = {
  center: WelcomeCenter;
  hints: boolean;
  kbd: boolean;
};

export type WelcomeSize = { width: number; height: number };

/**
 * The parts that fit: the whole centre block, the menu alone or nothing, the
 * hints only on a canvas with room around the block, and the chords only where
 * a row is wide enough to carry one beside its label.
 */
export function welcomeTiers({ width, height }: WelcomeSize): WelcomeTiers {
  const center: WelcomeCenter =
    width < WELCOME_MIN_WIDTH || height < WELCOME_MENU_MIN_HEIGHT
      ? 'none'
      : height < WELCOME_FULL_MIN_HEIGHT
        ? 'menu'
        : 'full';

  return {
    center,
    hints:
      width >= WELCOME_HINTS_MIN_WIDTH && height >= WELCOME_HINTS_MIN_HEIGHT,
    kbd: center !== 'none' && width >= WELCOME_KBD_MIN_WIDTH,
  };
}

/**
 * A document with no table, no shown memo and no shown group, which is what
 * the welcome screen stands over: the content bounds count the same, so the
 * map and the scrollbars leave as the screen comes and come as it leaves.
 */
export const isEmptyDocument = (state: RootState) => !hasContent(state);

/** Where along the welcome screen's width each hint points, or null where it has nothing to point at. */
export type WelcomeAnchors = {
  search: number | null;
  preferences: number | null;
};

/**
 * Reads where the toolbar buttons the hints point at stand, from the left edge
 * of the welcome screen. A button the toolbar left out, or clipped past the
 * edge, has none; the theme and language buttons share one anchor between them.
 */
export function measureAnchors(container: HTMLElement): WelcomeAnchors {
  const root = editorRootOf(container);
  const box = container.getBoundingClientRect();

  const centerOf = (selector: string): number | null => {
    const rect = root.querySelector(selector)?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;

    const x = rect.left + rect.width / 2 - box.left;
    return x >= 0 && x <= box.width ? x : null;
  };

  const theme = centerOf('.toolbar-theme');
  const locale = centerOf('.toolbar-locale');

  return {
    search: centerOf('.toolbar-search'),
    preferences:
      theme !== null && locale !== null
        ? (theme + locale) / 2
        : (theme ?? locale),
  };
}

/** Which side of its arrow a hint's label takes, read in the direction the text runs. */
export type HintSide = 'before' | 'after';

/**
 * Where a hint stands, as the distance of its outer edge from the left or the
 * right of the welcome screen; labelFirst puts the label left of the arrow,
 * which then climbs right to its tip, and otherwise the arrow is drawn mirrored.
 */
export type HintPlacement = {
  labelFirst: boolean;
  /** The label hangs under the arrow's tail, as the side it names has no room for it. */
  stacked: boolean;
  left?: number;
  right?: number;
};

/**
 * Places a hint so its arrow's tip meets the anchor, the label on the side it
 * names (before: left to right, left; right to left, right), or under the
 * arrow where that side has no room for a whole label, as beside the Explorer.
 */
export function hintPlacement(
  anchorX: number,
  rootWidth: number,
  side: HintSide,
  dir: TextDirection
): HintPlacement {
  const labelFirst = (side === 'before') === (dir === 'ltr');
  const { width, tipX } = ARROW_UP_BOX;
  const reach = width - tipX;
  const room = labelFirst
    ? anchorX - tipX - HINT_GAP
    : rootWidth - anchorX - tipX - HINT_GAP;

  if (room < HINT_LABEL_MAX_WIDTH) {
    return labelFirst
      ? { labelFirst, stacked: true, left: anchorX - tipX }
      : { labelFirst, stacked: true, right: rootWidth - anchorX - tipX };
  }
  return labelFirst
    ? { labelFirst, stacked: false, right: rootWidth - anchorX - reach }
    : { labelFirst, stacked: false, left: anchorX - reach };
}
