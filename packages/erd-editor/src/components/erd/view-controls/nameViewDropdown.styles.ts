import { css } from '@dineug/r-html';

import * as controls from '@/components/erd/view-controls/viewControls.styles';
import { typography } from '@/styles/typography.styles';

/*
 * The Name View trigger, which spells its view out before its chevron and so
 * cannot hold the square pill's width. The pill is spliced in, so this button
 * and its neighbours stay one bar.
 */
export const trigger = css`
  ${controls.menu}
  width: auto;
  padding: 0 6px;
  gap: 4px;
`;

/*
 * The three names stacked in one cell, the view in force shown and the others
 * kept for their width, so a pick never slides the centred bar under the hand,
 * in any language.
 */
export const label = css`
  ${typography.paragraph};
  display: grid;
  white-space: nowrap;
  user-select: none;

  & > * {
    grid-area: 1 / 1;
  }
`;

export const hidden = css`
  visibility: hidden;
`;

/*
 * The menu the trigger opens, over the bar rather than under it: the bar stands
 * at the bottom edge and a menu below it would open off the screen. The content
 * is anchored to the trigger and shifted by its own size.
 */
export const menu = css`
  & > .context-menu-content {
    transform: translate(-50%, -100%);
    z-index: 2;
  }
`;
