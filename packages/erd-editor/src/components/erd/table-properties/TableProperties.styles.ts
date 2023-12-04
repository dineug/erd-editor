import { css } from '@dineug/r-html';

export const root = css`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.4);
  }
`;

export const container = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 900px;
  max-height: calc(100% - 32px);
  position: relative;
  z-index: 1;
  background-color: var(--context-menu-background);
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  overflow: hidden;
`;

export const scrollbarArea = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: auto;
  padding: 0 12px 12px 12px;
`;

export const header = css`
  display: flex;
  padding: 0 8px;
  min-height: 32px;
  overflow-x: auto;
`;

export const tab = css`
  display: flex;
  max-width: 200px;
  height: 32px;
  padding: 0 12px;
  border-radius: 4px;
  cursor: default;
  align-items: center;

  &:hover {
    background-color: var(--context-menu-hover);
    color: var(--active);
    fill: var(--active);
  }

  &.selected {
    background-color: var(--context-menu-select);
    color: var(--active);
    fill: var(--active);
  }

  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const scope = css`
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 450px;
`;
