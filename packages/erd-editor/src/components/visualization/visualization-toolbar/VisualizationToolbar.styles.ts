import { css } from '@dineug/r-html';

import * as floating from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import { typography } from '@/styles/typography.styles';

/*
 * The row of tools over the middle of the bottom edge of the tab, where the
 * ERD's own compass pill stands: the scene above it is what the reader is
 * looking at, and a corner would put the tools where nothing else asks to be read.
 */
export const root = css`
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 4px;
  gap: 2px;
  border: 1px solid var(--toast-border);
  border-radius: 8px;
  background-color: var(--toast-background);
  box-shadow: 0 1px 6px -3px var(--minimap-shadow);
  z-index: 1;
`;

/* The line between one group of tools and the next, stood on its side. */
export const divider = css`
  width: 1px;
  height: 18px;
  margin: 1px 2px;
  background-color: var(--toast-border);
`;

/*
 * The zoom, as a percentage. Tabular figures at a width the three digits
 * always fit, so the buttons either side of it do not shift under a zoom run.
 */
export const readout = css`
  ${typography.paragraph};
  min-width: 44px;
  padding: 0 2px;
  text-align: center;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
  user-select: none;
`;

/*
 * The row display trigger, which spells its mode out before its chevron and so
 * cannot hold the square pill's width. The pill is spliced in rather than
 * declared again, so this button and its neighbours stay one bar.
 */
export const showModeTrigger = css`
  ${floating.menu}
  width: auto;
  padding: 0 6px;
  gap: 4px;
`;

/*
 * The mode the trigger stands on, spelled out in words. Held at the width of
 * the longest of the three, so picking another does not slide the centred bar
 * under the reader's hand.
 */
export const showModeLabel = css`
  ${typography.paragraph};
  min-width: 62px;
  white-space: nowrap;
  user-select: none;
`;

/*
 * The compass, which says how far the nearest content lies as well as which
 * way, and so carries a label the square pill has no room for. The pill is
 * spliced in the same way, at the gap the ERD's own compass keeps.
 */
export const compass = css`
  ${floating.menu}
  width: auto;
  padding: 0 6px;
  gap: 6px;
`;

/* Tabular figures, so the gap does not jitter as the digits change under a pan. */
export const compassDistance = css`
  ${typography.paragraph};
  font-variant-numeric: tabular-nums;
  user-select: none;
`;

/*
 * The menu that trigger opens, over the bar rather than under it: the bar
 * stands at the bottom edge and a menu below it would open off the screen.
 * The content is anchored to the trigger and shifted by its own size.
 */
export const showModeMenu = css`
  & > .context-menu-content {
    transform: translate(-50%, -100%);
    z-index: 2;
  }
`;
