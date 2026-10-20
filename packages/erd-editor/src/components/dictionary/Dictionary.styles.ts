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

/** The sheet switch, the search and the row buttons, on one line. */
export const bar = css`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
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
  height: 24px;
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

/** The search takes what the switch and the buttons leave, up to a width that keeps it a field. */
export const search = css`
  flex: 0 1 240px;
  min-width: 80px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--dictionary-grid-line);
  border-radius: 4px;
  background-color: var(--dictionary-background);
  ${typography.paragraph};

  &:focus {
    border-color: var(--focus);
  }
`;

/** The row buttons, pushed to the bar's end. */
export const actions = css`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-inline-start: auto;
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
