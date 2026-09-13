import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

/*
 * The row of tools over the middle of the bottom edge of the canvas, clear of
 * the scrollbar track under it and of the minimap in the corner. It stays in
 * zen mode, since the button that leaves zen mode is in it.
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

export const menu = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }

  &.active {
    color: var(--active);
    background-color: var(--context-menu-select);
  }
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

/* The line between one group of tools and the next, stood on its side. */
export const divider = css`
  width: 1px;
  height: 18px;
  margin: 1px 2px;
  background-color: var(--toast-border);
`;

/*
 * The compass, which says how far the nearest content lies as well as which
 * way, and so carries a label the square pill has no room for. The pill is
 * spliced in rather than declared again, so it stays one bar with the tools
 * beside it.
 */
export const compass = css`
  ${menu}
  width: auto;
  padding: 0 6px;
  gap: 6px;
`;

/* Tabular figures, so the gap does not jitter as the digits change under a pan. */
export const compassDistance = css`
  ${typography.paragraph};
  font-variant-numeric: tabular-nums;
  user-select: none;
`;
