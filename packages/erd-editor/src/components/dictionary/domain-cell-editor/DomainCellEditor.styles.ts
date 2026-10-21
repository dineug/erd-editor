import { css } from '@dineug/r-html';

import { floatingShadow } from '@/styles/elevation.styles';
import { TextFontFamily } from '@/styles/fonts.styles';

/** The height of one domain in the list. */
export const OPTION_HEIGHT = 26;

export const root = css`
  position: relative;
  width: 100%;
  height: 100%;
  font: 13px ${TextFontFamily};
`;

export const input = css`
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0 7px;
  border: 0;
  outline: none;
  color: var(--active);
  background-color: var(--dictionary-background);
  box-shadow: inset 0 0 0 2px var(--focus);
  font: inherit;
`;

export const list = css`
  position: absolute;
  z-index: 1;
  top: 100%;
  left: 0;
  box-sizing: border-box;
  min-width: 100%;
  margin-top: 2px;
  overflow-y: auto;
  overscroll-behavior: contain;
  color: var(--active);
  background-color: var(--dictionary-background);
  border: 1px solid var(--dictionary-grid-line);
  ${floatingShadow};
  white-space: nowrap;
`;

export const option = css`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
  height: ${OPTION_HEIGHT}px;
  cursor: pointer;

  &:hover {
    background-color: var(--dictionary-header-background);
  }

  &[aria-selected='true'] {
    background-color: var(--dictionary-header-select);
  }

  & > .kbd {
    margin-left: auto;
    visibility: hidden;
  }

  &[aria-selected='true'] > .kbd {
    visibility: visible;
  }
`;
