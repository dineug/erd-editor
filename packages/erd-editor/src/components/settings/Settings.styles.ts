import { css } from '@dineug/r-html';

export const root = css`
  display: flex;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 32px;
  background-color: var(--context-menu-background);

  .column-order-move {
    transition: transform 0.3s;
  }
`;

export const lnbArea = css`
  display: flex;
  width: 200px;
  height: 100%;
  overflow: hidden;
`;

export const contentArea = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding-inline-start: 16px;
`;

export const content = css`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: auto;
  flex-flow: wrap;
`;

export const section = css`
  margin-block: 0 32px;
  margin-inline: 0 32px;
  min-width: 300px;
`;

export const row = css`
  display: flex;
  white-space: nowrap;
  height: 24px;
  align-items: center;
  margin-bottom: 16px;
`;

export const vertical = (size: number) => css`
  width: ${size}px;
  height: 100%;
`;

export const lockSection = css`
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
`;

/*
 * The rows share the names' column, as wide as the longest name and never
 * under 140px, so a longer language moves every value along and covers none.
 */
export const lockList = css`
  display: grid;
  grid-template-columns: minmax(140px, max-content) max-content;
  grid-auto-rows: 28px;
  align-items: center;
  white-space: nowrap;
`;

export const lockRow = css`
  display: contents;
`;

export const lockName = css`
  padding-inline-end: 12px;
`;

/* A row's value and its button, so a long value moves its own button alone. */
export const lockControl = css`
  display: flex;
  align-items: center;
`;

/* The value the file keeps, dimmed while unlocked, when it follows the screen. */
export const lockValue = css`
  min-width: 120px;
  margin-inline-end: 8px;
  color: var(--placeholder);

  &[data-locked] {
    color: var(--foreground);
  }
`;

/* A 24px square tool, its lock in the accent while on. */
export const lockButton = css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: var(--placeholder);
  cursor: pointer;

  &[data-locked] {
    color: var(--active);
  }

  &:hover {
    background-color: var(--context-menu-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }
`;

export const columnOrderSection = css`
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
`;

export const columnOrderList = css`
  display: flex;
  flex-direction: column;
`;

export const columnOrderItem = css`
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 32px;
  cursor: move;
  border-radius: 4px;

  &:hover {
    background-color: var(--context-menu-hover);
    color: var(--active);
  }

  &.none-hover {
    background-color: transparent;
    color: var(--foreground);
  }

  &.dragging {
    opacity: 0.5;
  }
`;
