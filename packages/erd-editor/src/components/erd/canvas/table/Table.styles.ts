import { css } from '@dineug/r-html';

import { TABLE_PADDING } from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

export const root = css`
  position: absolute;
  background-color: var(--table-background);
  padding: ${TABLE_PADDING}px;
  border-radius: 6px;
  border: 1px solid transparent;
  fill: transparent;
  color: transparent;
  ${typography.paragraph};

  &:hover {
    fill: var(--foreground);
    color: var(--foreground);
  }

  &[selected] {
    border: 1px solid var(--table-select);
  }
`;

export const header = css`
  display: flex;
  flex-direction: column;
  position: relative;
`;

export const headerColor = css`
  position: absolute;
  top: -${TABLE_PADDING + 1}px;
  left: -${TABLE_PADDING}px;
  width: calc(100% + ${TABLE_PADDING * 2}px);
  min-height: 4px;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
`;

export const headerButtonWrap = css`
  display: flex;
  height: 12px;
  justify-content: flex-end;

  & > div {
    margin-left: 4px;
    cursor: pointer;
  }

  & > div:hover {
    fill: var(--active);
    color: var(--active);
  }
`;

export const headerInputWrap = css`
  display: flex;
`;
