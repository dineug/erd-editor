import { css } from '@dineug/r-html';

import { fontSize6 } from '@/styles/typography.styles';

export const root = css`
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 32px;

  .column-order-move {
    transition: transform 0.3s;
  }
`;

export const title = css`
  ${fontSize6};
`;

export const content = css`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: auto;
  flex-flow: wrap;
`;

export const section = css`
  margin: 0 32px 32px 0;
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
    fill: var(--active);
  }

  &.none-hover {
    background-color: transparent;
    color: var(--foreground);
    fill: var(--foreground);
  }

  &.draggable {
    opacity: 0.5;
  }
`;

export const shortcutsSection = css`
  margin: 0 32px 32px 0;
  min-width: calc(100% - 364px);
`;
