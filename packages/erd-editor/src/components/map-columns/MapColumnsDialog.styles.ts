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

export const title = css`
  margin: 0;
  color: var(--active);
  font-weight: var(--font-weight-medium);
  ${fontSize4};
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

/** The parent column, its list and the note under it; two columns side by side unless stacked. */
export const grid = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 8px;

  &.stacked {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 4px;
  }
`;

export const heading = css`
  color: var(--placeholder);
  ${typography.paragraph};
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

/** A line under a row, across both columns. */
export const note = css`
  grid-column: 1 / -1;
  margin-top: -4px;
  color: var(--placeholder);
  ${typography.paragraph};
`;

export const message = css`
  color: var(--placeholder);
  ${typography.paragraph};

  &.error {
    color: var(--diff-delete-foreground);
  }
`;

export const actions = css`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;

  & > button:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;
