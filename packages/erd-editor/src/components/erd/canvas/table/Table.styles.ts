import { css } from '@dineug/r-html';

import {
  INPUT_MARGIN_RIGHT,
  TABLE_HEADER_BUTTON_MARGIN_LEFT,
  TABLE_HEADER_HEIGHT,
  TABLE_HEADER_PADDING,
  TABLE_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

export const root = css`
  position: absolute;
  background-color: var(--table-background);
  padding: ${TABLE_PADDING}px 0;
  border-radius: 6px;
  border: 1px solid var(--table-border);
  fill: transparent;
  color: transparent;
  ${typography.paragraph};

  &:hover {
    fill: var(--foreground);
    color: var(--foreground);
  }

  &[data-selected] {
    border: 1px solid var(--table-select);
  }
`;

export const header = css`
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 0 ${TABLE_PADDING}px;
`;

export const headerColor = css`
  position: absolute;
  top: -${TABLE_PADDING + 1}px;
  left: 0;
  width: 100%;
  min-height: 4px;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
`;

export const headerInputWrap = css`
  display: flex;
  height: ${TABLE_HEADER_HEIGHT}px;
  align-items: center;
  padding: ${TABLE_HEADER_PADDING}px 0;

  & > .edit-input {
    margin-right: ${INPUT_MARGIN_RIGHT}px;
  }
`;

export const headerButtonWrap = css`
  display: flex;
  height: 100%;
  align-items: center;
  margin-left: auto;

  & > .icon {
    cursor: pointer;
  }

  & > .icon:last-child {
    margin-left: ${TABLE_HEADER_BUTTON_MARGIN_LEFT}px;
  }

  & > .icon:hover {
    fill: var(--active);
    color: var(--active);
  }
`;
