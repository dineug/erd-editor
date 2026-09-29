import { css } from '@dineug/r-html';

import { floatingShadow } from '@/styles/elevation.styles';
import { typography } from '@/styles/typography.styles';

/**
 * A panel over the top left of the canvas, clear of the minimap in the other
 * corner. Its top and height are set inline, since zen mode takes the toolbar
 * above it away; on a short canvas the list gives up its height first.
 */
export const root = css`
  position: absolute;
  left: 16px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 380px;
  max-width: calc(100% - 32px);
  overflow: hidden;
  padding: 12px;
  background-color: var(--context-menu-background);
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  ${floatingShadow};
  color: var(--foreground);
  ${typography.paragraph};
`;

export const header = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--active);
  ${typography.normal};
`;

export const row = css`
  display: flex;
  align-items: center;
  gap: 4px;
`;

/* The tools after a field, one width in both rows, so the two fields line up. */
export const actions = css`
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  width: 86px;
`;

export const input = css`
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--context-menu-border);
  border-radius: 4px;
  ${typography.normal};

  &:focus {
    border-color: var(--focus);
  }

  &.invalid {
    border-color: var(--diff-delete-foreground);
  }
`;

/* A square tool, the same pill the floating toolbar draws, pressed while its option is on. */
export const toggle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }

  &.active {
    color: var(--active);
    background-color: var(--context-menu-select);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
    background-color: transparent;
  }
`;

export const scopes = css`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

export const scope = css`
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--context-menu-border);
  border-radius: 9999px;
  color: var(--foreground);
  cursor: pointer;
  ${typography.paragraph};

  &:hover {
    color: var(--active);
  }

  &.active {
    color: var(--accent-color-11);
    border-color: var(--accent-color-8);
    background-color: var(--accent-color-3);
  }
`;

export const status = css`
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
`;

export const count = css`
  flex: 1;
  color: var(--placeholder);
  font-variant-numeric: tabular-nums;

  &.invalid {
    color: var(--diff-delete-foreground);
  }
`;

export const list = css`
  display: flex;
  flex-direction: column;
  max-height: 320px;
  min-height: 0;
  overflow: auto;
  margin: 0 -12px -12px;
  border-top: 1px solid var(--context-menu-border);
`;

export const match = css`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 6px 12px;
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
  flex-shrink: 0;
  color: var(--placeholder);
`;

/* The excerpt on one line and where it is found under it, each cut short at the panel's edge. */
export const body = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
`;

export const text = css`
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--foreground);
  ${typography.normal};
`;

export const mark = css`
  border-radius: 2px;
  color: var(--accent-color-12);
  background-color: var(--accent-color-5);
`;

export const location = css`
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--placeholder);
`;

export const more = css`
  flex-shrink: 0;
  padding: 8px 12px;
  color: var(--placeholder);
`;
