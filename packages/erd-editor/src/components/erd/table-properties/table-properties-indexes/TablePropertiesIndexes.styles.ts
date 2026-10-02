import { css } from '@dineug/r-html';

import {
  COLUMN_HEIGHT,
  COLUMN_UNIQUE_WIDTH,
  TABLE_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/**
 * The keys and indexes, which keep their width and stand above the columns
 * once the dialog is too narrow for the two panes side by side.
 */
export const leftArea = css`
  flex: 0 1 260px;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  ${typography.paragraph};
`;

/* The columns, which take what the keys leave and scroll sideways past that. */
export const rightArea = css`
  flex: 1 1 520px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  ${typography.paragraph};
`;

/* A group's name over its rows, a row tall, and what the group shows at its right end. */
export const sectionLabel = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: ${COLUMN_HEIGHT}px;
  padding: 0 ${TABLE_PADDING}px;
  color: var(--foreground);
  font-weight: var(--font-weight-medium);
  flex-shrink: 0;
`;

/* Read, not hinted at: the placeholder colour is too faint for a sentence. */
export const sectionStatus = css`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: var(--font-weight-regular);
  font-variant-numeric: tabular-nums;
  color: var(--foreground);

  & > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

/* Where a list has nothing to show yet, a row saying so. */
export const hint = css`
  display: flex;
  align-items: center;
  height: ${COLUMN_HEIGHT}px;
  padding: 0 ${TABLE_PADDING}px;
  color: var(--foreground);
`;

export const addIndexButtonArea = css`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: ${COLUMN_HEIGHT}px;
  padding: 0 ${TABLE_PADDING}px;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    background-color: var(--column-hover);
    color: var(--active);
  }
`;

/* The plus in the column of the toggles above it, so the label starts where the names do. */
export const addIcon = css`
  flex-shrink: 0;
  width: ${COLUMN_UNIQUE_WIDTH}px;
  justify-content: center;
`;

/** The body's padding, which a stuck order covers so no row shows under it. */
const BODY_PADDING = 12;

/**
 * The selected index's column order, ruled off under the columns. It sticks
 * to the bottom of the body while a long list scrolls, and sits in place
 * under a short one.
 */
export const order = css`
  margin-top: 12px;
  margin-bottom: -${BODY_PADDING}px;
  padding-bottom: ${BODY_PADDING}px;
  position: sticky;
  bottom: -${BODY_PADDING}px;
  z-index: 1;
  background-color: var(--context-menu-background);
  border-top: 1px solid var(--context-menu-border);
`;
