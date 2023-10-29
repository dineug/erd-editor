import { css } from '@dineug/r-html';

import {
  HEADER_ICON_HEIGHT,
  HEADER_ICON_MARGIN_BOTTOM,
  MEMO_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

export const root = css`
  position: absolute;
  background-color: var(--memo-background);
  border-radius: 6px;
  border: 1px solid var(--memo-border);
  fill: transparent;
  color: transparent;

  &:hover {
    fill: var(--foreground);
    color: var(--foreground);
  }

  &[data-selected] {
    border: 1px solid var(--memo-select);
  }
`;

export const container = css`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: ${MEMO_PADDING}px;
  width: 100%;
  height: 100%;
`;

export const header = css`
  display: flex;
  flex-direction: column;
  position: relative;
`;

export const headerColor = css`
  position: absolute;
  top: -${MEMO_PADDING + 1}px;
  left: -${MEMO_PADDING}px;
  width: calc(100% + ${MEMO_PADDING * 2}px);
  min-height: 4px;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
`;

export const headerButtonWrap = css`
  display: flex;
  height: ${HEADER_ICON_HEIGHT}px;
  justify-content: flex-end;
  margin-bottom: ${HEADER_ICON_MARGIN_BOTTOM}px;

  & > .icon {
    margin-left: 4px;
    cursor: pointer;
  }

  & > .icon:hover {
    fill: var(--active);
    color: var(--active);
  }
`;

export const textarea = css`
  resize: none;
  background-color: transparent;
  ${typography.paragraph};
  line-height: normal;
`;
