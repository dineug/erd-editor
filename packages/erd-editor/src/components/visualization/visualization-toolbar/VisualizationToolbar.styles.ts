import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

/*
 * The row of tools over the middle of the bottom edge of the tab, where the
 * ERD's own compass pill stands: the scene above it is what the reader is
 * looking at, and a corner would put the tools where nothing else asks to be read.
 */
export const root = css`
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 4px;
  gap: 2px;
  border: 1px solid var(--toast-border);
  border-radius: 8px;
  background-color: var(--toast-background);
  box-shadow: 0 1px 6px -3px var(--minimap-shadow);
  z-index: 1;
`;

/* The line between one group of tools and the next, stood on its side. */
export const divider = css`
  width: 1px;
  height: 18px;
  margin: 1px 2px;
  background-color: var(--toast-border);
`;

/*
 * The zoom, as a percentage. Tabular figures at a width the three digits
 * always fit, so the buttons either side of it do not shift under a zoom run.
 */
export const readout = css`
  ${typography.paragraph};
  min-width: 44px;
  padding: 0 2px;
  text-align: center;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
  user-select: none;
`;
