import { css } from '@dineug/r-html';

import {
  TABLE_PROPERTIES_BODY_PADDING,
  TOOLBAR_HEIGHT,
} from '@/constants/layout';
import { floatingShadow } from '@/styles/elevation.styles';
import { typography } from '@/styles/typography.styles';

/** The palette's line, 60px under the editor's top edge, measured from the canvas under the toolbar. */
const PANEL_TOP = 60 - TOOLBAR_HEIGHT;

/**
 * Dims the canvas and hangs the dialog from the palette's line, so switching
 * tabs never moves its top edge.
 */
export const root = css`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: ${PANEL_TOP}px 16px 16px;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.4);
  }
`;

/**
 * One fixed box for all three tabs, so the frame never jumps; a short host
 * gets the height it has. It sets no font size, or the tabs would shrink too.
 */
export const container = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1040px;
  height: 600px;
  max-height: 100%;
  position: relative;
  z-index: 1;
  background-color: var(--context-menu-background);
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  ${floatingShadow};
  overflow: hidden;
`;

/* The title, the tables opened lately and the close button, on one 48px line ruled off below. */
export const header = css`
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  flex-shrink: 0;
  padding: 0 12px;
  border-bottom: 1px solid var(--context-menu-border);
`;

export const title = css`
  ${typography.normal};
  color: var(--active);
  white-space: nowrap;
  flex-shrink: 0;
`;

/* Says the editor is read only, as quietly as a table chip, which it stands before. */
export const readonlyBadge = css`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  height: 20px;
  padding: 0 6px;
  border: 1px solid var(--context-menu-border);
  border-radius: 3px;
  color: var(--foreground);
  white-space: nowrap;
  ${typography.paragraph};
`;

/**
 * Shades a sideways scroller's edge only where more lies past it: two covers
 * in the panel colour, solid as wide as a shade, ride with the content over
 * two edge shades, the cue an overlay scrollbar leaves out.
 */
export const edgeShade = css`
  background-image:
    linear-gradient(to right, var(--context-menu-background) 50%, transparent),
    linear-gradient(to left, var(--context-menu-background) 50%, transparent),
    linear-gradient(to right, var(--context-menu-border), transparent),
    linear-gradient(to left, var(--context-menu-border), transparent);
  background-position:
    left center,
    right center,
    left center,
    right center;
  background-size:
    24px 100%,
    24px 100%,
    12px 100%,
    12px 100%;
  background-repeat: no-repeat;
  background-attachment: local, local, scroll, scroll;
  background-clip: content-box;
`;

/* The tables opened lately, which scroll sideways under the edge shade once they outgrow the row. */
export const tables = css`
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  padding: 2px 0;
  ${edgeShade};
`;

/* A pill, in the accent's steps 3, 8 and 11 once picked, lighter than the section tabs under it. */
export const tableChip = css`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  max-width: 160px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--context-menu-border);
  border-radius: 9999px;
  color: var(--foreground);
  cursor: pointer;
  ${typography.paragraph};

  &:hover {
    color: var(--active);
  }

  &.selected {
    color: var(--accent-color-11);
    border-color: var(--accent-color-8);
    background-color: var(--accent-color-3);
  }

  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/* A 26px square tool tinted under the pointer, the one control here the keyboard reaches. */
export const close = css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }
`;

/* The one scroll area of the body; a code tab's font size is its own, so this sets none. */
export const scrollbarArea = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  padding: ${TABLE_PROPERTIES_BODY_PADDING}px;
  overflow: auto;
`;

/**
 * The Indexes panes side by side, stacked once the dialog is too narrow for
 * both; a code tab instead fills the body as a well that scrolls on its own.
 */
export const scope = css`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  flex-shrink: 0;

  &.code {
    flex: 1 1 auto;
    min-height: 0;
    flex-wrap: nowrap;
    border: 1px solid var(--context-menu-border);
    border-radius: 4px;
    overflow: hidden;
  }
`;
