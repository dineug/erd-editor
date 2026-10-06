import { css } from '@dineug/r-html';

import { floatingShadow } from '@/styles/elevation.styles';
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
  ${floatingShadow};
  overflow: hidden;
`;

/* The input and, after it, the scope a prefix narrows to, which leaves the caret where it was. */
export const field = css`
  display: flex;
  align-items: center;
`;

export const search = css`
  flex: 1;
  min-width: 0;
  height: 50px;
  min-height: 50px;
  padding: 12px 16px;
  ${fontSize3};
`;

export const scope = css`
  flex-shrink: 0;
  margin-inline-end: 16px;
  padding: 0 8px;
  border: 1px solid var(--accent-color-8);
  border-radius: 9999px;
  white-space: nowrap;
  color: var(--accent-color-11);
  background-color: var(--accent-color-3);
  ${typography.paragraph};
`;

export const hint = css`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 0 16px 12px;
`;

export const hintItem = css`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--placeholder);
  cursor: pointer;
  ${typography.paragraph};

  &:hover {
    color: var(--active);
  }
`;

/* The line saying no command matches what is typed even loosely, above the prefixes offered. */
export const empty = css`
  padding: 0 16px 12px;
  color: var(--placeholder);
  ${typography.paragraph};
`;

/* A prefix character drawn as a key, in the hint and in the help rows. */
export const prefix = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border: 1px solid var(--context-menu-border);
  border-radius: 3px;
  color: var(--foreground);
  font-family: var(--code-font-family);
  ${typography.paragraph};
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
  min-height: 45px;
  height: 45px;

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
  margin-inline-end: 8px;
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
  margin-inline-start: auto;
  padding-inline-start: 24px;
`;
