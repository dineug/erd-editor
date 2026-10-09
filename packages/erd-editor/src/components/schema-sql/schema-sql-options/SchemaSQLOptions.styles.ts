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

/** A list beside its name, as wide whatever the database or the bracket. */
export const select = css`
  width: 132px;
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

/** The Tables list: All, each table group, then No group. */
export const choices = css`
  display: flex;
  flex-direction: column;
`;

/**
 * A box and its name on one line, the whole line taking the press; the box
 * in the accent colour once checked, a dash while All is mixed.
 */
export const choice = css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  color: var(--foreground);
  cursor: pointer;
  ${typography.paragraph};

  &:hover {
    color: var(--active);
  }

  & input[type='checkbox'] {
    appearance: none;
    flex: none;
    width: 14px;
    height: 14px;
    margin: 0;
    border-radius: 3px;
    background-color: transparent;
    box-shadow: inset 0 0 0 1px var(--gray-color-10);
    background-repeat: no-repeat;
    background-position: center;
    background-size: 10px;
    cursor: pointer;
  }

  &:hover input[type='checkbox']:not(:checked):not(:indeterminate) {
    box-shadow: inset 0 0 0 1px var(--gray-color-11);
  }

  & input[type='checkbox']:checked {
    background-color: var(--accent-color-9);
    box-shadow: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2 5.2 4.1 7.2 8 3' fill='none' stroke='%23fff' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  }

  & input[type='checkbox']:indeterminate {
    background-color: var(--accent-color-9);
    box-shadow: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2.5 5h5' fill='none' stroke='%23fff' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E");
  }

  & input[type='checkbox']:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }

  @media (forced-colors: active) {
    & input[type='checkbox'] {
      appearance: auto;
      background-image: none;
      box-shadow: none;
    }
  }
`;

/** A table group's color, ringed so a pale one shows on the panel. */
export const dot = css`
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px var(--context-menu-border);
`;

/** A name cut to one line; a group without one reads unnamed, dimmed. */
export const choiceName = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.unnamed {
    color: var(--placeholder);
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
