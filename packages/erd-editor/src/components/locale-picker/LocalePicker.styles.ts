import { css } from '@dineug/r-html';

import { floatingShadow } from '@/styles/elevation.styles';
import { typography } from '@/styles/typography.styles';

/**
 * Hung where the theme builder hangs, on the reading side of the editor, and
 * never taller than the editor below the toolbar: the list scrolls instead.
 */
export const root = css`
  position: absolute;
  top: 46px;
  inset-inline-start: 16px;
  z-index: 1;
  width: 260px;
  max-height: calc(100% - 62px);
  display: flex;
  flex-direction: column;
  padding: 8px;
  background-color: var(--context-menu-background);
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  ${floatingShadow};
`;

export const title = css`
  flex-shrink: 0;
  padding: 4px 8px 8px;
  color: var(--active);
  ${typography.normal};
`;

export const list = css`
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
`;

export const option = css`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border-radius: 4px;
  text-align: start;
  color: var(--foreground);
  cursor: pointer;
  ${typography.paragraph};

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }

  &:focus-visible {
    box-shadow: inset 0 0 0 1px var(--input-active);
  }

  &[aria-selected='true'] {
    color: var(--active);
  }
`;

export const check = css`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: 14px;
`;

export const label = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const hint = css`
  margin-inline-start: auto;
  color: var(--placeholder);
  white-space: nowrap;
`;
