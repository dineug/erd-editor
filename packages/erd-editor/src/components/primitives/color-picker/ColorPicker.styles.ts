import { css } from '@dineug/r-html';

import { fontSize2 } from '@/styles/typography.styles';

export const container = css`
  position: absolute;
`;

/*
 * The picker root is inline-block, which a flex host keeps from adding a
 * baseline gap above the No color button.
 */
export const picker = css`
  display: flex;
`;

/** A row the width of the picker above it, on the menu surface. */
export const clear = css`
  display: block;
  width: 100%;
  height: 28px;
  margin-top: 4px;
  padding: 0 12px;
  border: 1px solid var(--context-menu-border);
  border-radius: 3px;
  background-color: var(--context-menu-background);
  color: var(--foreground);
  box-shadow: 0 0 10px 2px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  ${fontSize2};

  &:hover {
    background-color: var(--context-menu-hover);
    color: var(--active);
  }

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }
`;
