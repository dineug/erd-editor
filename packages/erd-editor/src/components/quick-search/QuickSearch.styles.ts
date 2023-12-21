import { css } from '@dineug/r-html';

import { fontSize3, typography } from '@/styles/typography.styles';

export const root = css`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: start;
  justify-content: center;
  padding: 60px 16px 16px;
  z-index: 2147483647;

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
  max-width: 600px;
  position: relative;
  z-index: 1;
  background-color: var(--context-menu-background);
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  overflow: hidden;
`;

export const search = css`
  height: 50px;
  min-height: 50px;
  padding: 12px 16px;
  ${fontSize3};
`;

export const list = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 400px;
  overflow: auto;
`;

export const action = css`
  display: flex;
  padding: 12px 16px;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;

  &:hover {
    background-color: var(--column-hover);
  }

  &.selected {
    background-color: var(--column-select);
  }
`;

export const icon = css`
  display: flex;
  align-items: center;
  min-width: 14px;
  margin-right: 8px;
`;

export const name = css`
  overflow: hidden;
  text-overflow: ellipsis;
  ${typography.normal};
`;

export const keyword = css`
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--placeholder);
  ${typography.paragraph};
`;

export const vertical = css`
  width: 8px;
  height: 100%;
`;

export const shortcut = css`
  display: flex;
  align-items: center;
  margin-left: auto;
  padding-left: 24px;
`;
