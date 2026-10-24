import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

/*
 * The pill a tool of a floating bar is drawn in, the view controls' and the
 * bar's own alike. The bars take it from here, so the controls and the tools
 * beside them stay one bar.
 */
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
    background-color: var(--gray-color-3);
  }

  &.active {
    color: var(--active);
    background-color: var(--context-menu-select);
  }

  &.disabled {
    cursor: not-allowed;
    color: var(--foreground);
    background-color: transparent;
    opacity: 0.4;
  }
`;

/*
 * The zoom, as a percentage, and the button that puts it back to 100%. The pill
 * is spliced in and widened to a width the three digits always fit, in tabular
 * figures, so the buttons either side of it do not shift under a zoom run.
 */
export const readout = css`
  ${menu}
  ${typography.paragraph};
  width: auto;
  min-width: 44px;
  padding: 0 2px;
  text-align: center;
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
