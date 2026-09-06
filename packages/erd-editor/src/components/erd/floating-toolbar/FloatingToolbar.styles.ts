import { css } from '@dineug/r-html';

/*
 * The column of tools over the top left corner of the canvas, opposite the
 * minimap. It stays in zen mode, since the button that leaves zen mode is in it.
 */
export const root = css`
  position: absolute;
  left: 20px;
  top: 20px;
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 2px;
  border: 1px solid var(--toast-border);
  border-radius: 8px;
  background-color: var(--toast-background);
  box-shadow: 0 1px 6px -3px var(--minimap-shadow);
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

/* The line between the tools, the notations and the mode below them. */
export const divider = css`
  height: 1px;
  margin: 2px 1px;
  background-color: var(--toast-border);
`;
