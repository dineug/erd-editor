import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

/** The bar, the sheet under it and the status line at the foot. */
export const root = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--canvas-background);
  ${typography.paragraph};
`;

/**
 * The sheet switch, the search and the row and file tools, on one line while
 * they fit and on more where they do not, since the tab clips what overflows
 * it and a narrow pane would hide the tools. Each control stands 28px high.
 */
export const bar = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  flex: 0 0 auto;
  gap: 6px 8px;
  min-width: 0;
  padding: 8px 12px;
  border-bottom: 1px solid var(--dictionary-grid-line);
`;

export const segments = css`
  display: inline-flex;
  flex: 0 0 auto;
  border: 1px solid var(--dictionary-grid-line);
  border-radius: 6px;
  overflow: hidden;
`;

export const segment = css`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  color: var(--foreground);
  cursor: pointer;
  white-space: nowrap;
  ${typography.paragraph};

  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  & + & {
    border-inline-start: 1px solid var(--dictionary-grid-line);
  }

  &:hover {
    color: var(--active);
    background-color: var(--gray-color-4);
  }

  &[aria-pressed='true'] {
    color: var(--accent-color-11);
    background-color: var(--accent-color-3);
  }
`;

/** A sheet's row count beside its name, quieter than the name. */
export const count = css`
  color: var(--placeholder);
  font-variant-numeric: tabular-nums;

  [aria-pressed='true'] > & {
    color: inherit;
    opacity: 0.72;
  }
`;

/** The check sheet's count in the colour of the loudest check it holds. */
export const countError = css`
  color: var(--dictionary-error-foreground);
  font-weight: 500;

  [aria-pressed='true'] > & {
    color: var(--dictionary-error-foreground);
    opacity: 1;
  }
`;

export const countWarning = css`
  color: var(--dictionary-warning-foreground);
  font-weight: 500;

  [aria-pressed='true'] > & {
    color: var(--dictionary-warning-foreground);
    opacity: 1;
  }
`;

/** The search takes what the switch and the tools leave, up to a width that keeps it a field. */
export const searchField = css`
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 1 260px;
  min-width: 120px;
  height: 28px;
  color: var(--placeholder);
`;

export const searchIcon = css`
  position: absolute;
  inset-inline-start: 8px;
  display: flex;
  pointer-events: none;
`;

export const search = css`
  width: 100%;
  height: 100%;
  padding-inline: 28px;
  border: 1px solid var(--dictionary-grid-line);
  border-radius: 6px;
  background-color: var(--dictionary-background);
  ${typography.paragraph};

  &:focus {
    border-color: var(--focus);
  }
`;

/** Clears the search, shown while it holds text. */
export const clear = css`
  position: absolute;
  inset-inline-end: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 4px;
  color: var(--placeholder);
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--gray-color-4);
  }

  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
`;

/** The row and file tools, pushed to the bar's end, a rule between the two groups. */
export const tools = css`
  display: flex;
  align-items: center;
  gap: 2px;
  margin-inline-start: auto;
`;

export const tool = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--gray-color-4);
  }

  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
`;

/** Delete, which reads as the one tool that takes rows away once it is under the pointer. */
export const toolDanger = css`
  &:hover {
    color: var(--dictionary-error-foreground);
  }
`;

export const divider = css`
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background-color: var(--dictionary-grid-line);
`;

/** The grid fills what the bar and the status line leave. */
export const sheet = css`
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  background-color: var(--dictionary-background);
`;

/** What to do on a sheet with no row, over the grid's empty cells and out of the pointer's way. */
export const empty = css`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 16px;
  text-align: center;
  color: var(--placeholder);
  pointer-events: none;
  ${typography.paragraph};
`;

export const status = css`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 12px;
  height: 24px;
  padding: 0 12px;
  border-top: 1px solid var(--dictionary-grid-line);
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
`;
