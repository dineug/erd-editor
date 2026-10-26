import { css } from '@dineug/r-html';

import { TOOLBAR_HEIGHT } from '@/constants/layout';

export const root = css`
  display: flex;
  width: 100%;
  height: ${TOOLBAR_HEIGHT}px;
  min-height: ${TOOLBAR_HEIGHT}px;
  padding: 0 15px;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  background-color: var(--toolbar-background);

  & > input {
    margin-inline-end: 15px;
  }
`;

/*
 * A readonly editor's database name: text where the field stood, as wide and
 * spaced as it, and the field's placeholder, dimmed, while there is no name.
 */
export const databaseName = css`
  /* the field's font: the control font each engine gives an input, in the reset's family */
  font: -moz-field;
  font: -webkit-small-control;
  font-family: var(--text-font-family);
  flex-shrink: 0;
  margin-inline-end: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--active);

  &[data-empty] {
    color: var(--placeholder);
  }
`;

export const vertical = css`
  width: 10px;
  height: 100%;
`;

export const menu = css`
  cursor: pointer;
  padding: 0 5px;
  display: flex;
  align-items: center;
  height: 100%;

  &.active {
    color: var(--active);
  }
  &:hover {
    color: var(--active);
  }

  &.undo-redo {
    cursor: not-allowed;
    color: var(--foreground);
  }

  &.undo-redo.active {
    cursor: pointer;
    color: var(--active);
  }

  &.disabled {
    cursor: not-allowed;
    color: var(--foreground);
    opacity: 0.4;
  }
`;
