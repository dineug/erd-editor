import { css } from '@dineug/r-html';

import * as floating from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import { typography } from '@/styles/typography.styles';

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
