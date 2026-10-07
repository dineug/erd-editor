import { css } from '@dineug/r-html';

import { SCHEMA_SQL_PANEL_WIDTH } from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/**
 * The options beside the code, a fixed width whatever the editor's, its rule
 * on the left, where the code stands in every language.
 */
export const panel = css`
  width: ${SCHEMA_SQL_PANEL_WIDTH}px;
  flex-shrink: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--context-menu-background);
  border-left: 1px solid var(--context-menu-border);
  color: var(--foreground);
  ${typography.normal};
`;

export const head = css`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 26px;
  padding: 16px 20px 0;
`;

export const title = css`
  color: var(--active);
  font-weight: var(--font-weight-medium);
`;

/** The part that scrolls, between the title and the buttons. */
export const body = css`
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 20px 12px;
`;

export const group = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

/** A group under a rule, drawn halfway into the gap above it. */
export const separated = css`
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -8.5px;
    height: 1px;
    background-color: var(--context-menu-border);
  }
`;

/* A label and its control on one line, the label taking what is left. */
export const row = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
`;

/* A label over its control. */
export const column = css`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const caption = css`
  color: var(--placeholder);
  ${typography.paragraph};
`;

export const note = css`
  color: var(--placeholder);
  overflow-wrap: anywhere;
  ${typography.paragraph};
`;

/** A native list in the panel's colours; its popup takes the appearance from color-scheme. */
export const select = css`
  width: 132px;
  height: 28px;
  padding: 0 4px;
  border: 1px solid var(--context-menu-border);
  border-radius: 4px;
  color: var(--active);
  background-color: var(--context-menu-background);
  ${typography.paragraph};

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }
`;

/* Three choices as one segmented control, as wide as its labels. */
export const segments = css`
  display: inline-flex;
  align-self: flex-start;
  max-width: 100%;
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  overflow: hidden;
`;

export const segment = css`
  min-width: 40px;
  height: 26px;
  padding: 0 8px;
  color: var(--foreground);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
  ${typography.paragraph};

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }

  & + & {
    border-inline-start: 1px solid var(--context-menu-border);
  }

  &:hover:not([aria-disabled='true']) {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }

  &[aria-pressed='true'] {
    color: var(--accent-color-11);
    background-color: var(--accent-color-3);
  }

  &[aria-disabled='true'] {
    opacity: 0.4;
    cursor: default;
  }
`;

/**
 * What a drop and re-create takes with it, in the colours of a deleted line,
 * a long table name broken to stay inside the box.
 */
export const warning = css`
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background-color: var(--diff-delete-background);
  color: var(--diff-delete-foreground);
  ${typography.paragraph};

  & > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;

/** One line of the text tall, so the icon stands beside the first. */
export const warningIcon = css`
  flex-shrink: 0;
  align-self: flex-start;
  height: var(--line-height-1);
`;

/** The buttons under the scrolling part, always in sight. */
export const foot = css`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--context-menu-border);
  background-color: var(--context-menu-background);
`;

export const actions = css`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

export const action = css`
  gap: 6px;

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }
`;

/** A square icon button: the panel's Hide and the code's Show. */
export const icon = css`
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--foreground);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }
`;
