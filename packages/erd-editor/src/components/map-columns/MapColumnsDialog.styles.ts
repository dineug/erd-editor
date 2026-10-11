import { css } from '@dineug/r-html';

import { fontSize4, typography } from '@/styles/typography.styles';

/**
 * The dialog's one column, its native lists drawn in the editor's appearance
 * through color-scheme, which they inherit, and ringed 2px off as its buttons
 * are, the doubled class outweighing the list box's own ring.
 */
export const body = css`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  color: var(--foreground);
  ${typography.normal};

  & button:focus-visible,
  && select:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 2px;
  }
`;

/* The title and the close button on one line, the button at the end the line ends at. */
export const header = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

export const title = css`
  margin: 0;
  color: var(--active);
  font-weight: var(--font-weight-medium);
  ${fontSize4};
`;

/**
 * A 26px square tool tinted under the pointer, as Export image and Table
 * Properties close. Tab brings its whole focus ring into a box scrolled down.
 */
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
  scroll-margin: 6px;

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }
`;

export const subtitle = css`
  margin-top: -8px;
  color: var(--placeholder);
  overflow-wrap: anywhere;
  ${typography.paragraph};
`;

/** A list as wide as its cell, narrowing with the box. */
export const select = css`
  width: 100%;
  min-width: 0;
`;

export const references = css`
  display: flex;
  align-items: center;
  gap: 12px;

  & > span {
    flex-shrink: 0;
  }
`;

/**
 * The parent column, an arrow to its list and the note under the list; side by
 * side unless stacked, where the parent takes a line over the arrow and list.
 */
export const grid = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 8px;

  &.stacked {
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 8px;
    row-gap: 4px;
  }
`;

/* A table's name and the role its columns play, the name cut short first. */
export const heading = css`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--placeholder);
  ${typography.paragraph};
`;

export const headingIcon = css`
  flex-shrink: 0;
`;

export const tableName = css`
  min-width: 0;
  color: var(--active);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const role = css`
  flex-shrink: 0;
`;

export const arrow = css`
  color: var(--placeholder);
`;

export const parent = css`
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;

  & > span:first-child {
    color: var(--active);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stacked > & {
    grid-column: 1 / -1;
    margin-top: 8px;
  }
`;

export const dim = css`
  color: var(--placeholder) !important;
`;

export const dataType = css`
  flex-shrink: 0;
  color: var(--placeholder);
  ${typography.paragraph};
`;

/**
 * A line under the list it is about, whose child column the mapping changes
 * or leaves of another type, marked so it reads as more than a hint.
 */
export const note = css`
  grid-column: -2 / -1;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: -4px;
  color: var(--foreground);
  ${typography.paragraph};

  & > .icon {
    flex-shrink: 0;
    color: var(--map-columns-error);
  }

  &.changes > .icon {
    color: var(--accent-color-11);
  }
`;

export const message = css`
  color: var(--placeholder);
  ${typography.paragraph};

  &.error {
    color: var(--map-columns-error);
  }
`;

export const actions = css`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;

  & > button:disabled,
  & > button:disabled:hover {
    color: var(--gray-color-8);
    background-color: var(--gray-color-3);
    cursor: default;
  }
`;
