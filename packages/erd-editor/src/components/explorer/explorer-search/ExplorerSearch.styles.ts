import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

export const root = css`
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  gap: 4px;
  padding: 2px 8px 6px;
  border-bottom: 1px solid var(--explorer-border);
  ${typography.paragraph};
`;

export const fields = css`
  display: flex;
  align-items: flex-start;
  gap: 2px;
`;

export const rows = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 4px;
  min-width: 0;
`;

export const row = css`
  display: flex;
  align-items: center;
  gap: 2px;
`;

/* A field and the options it carries inside its border, as an editor's find draws them. */
export const field = css`
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  gap: 1px;
  min-width: 0;
  height: 26px;
  padding-inline-end: 2px;
  box-sizing: border-box;
  border: 1px solid var(--explorer-border);
  border-radius: 4px;
  background-color: var(--tree-background);

  &:focus-within {
    border-color: var(--focus);
  }

  &.invalid {
    border-color: var(--find-replace-error);
  }
`;

export const input = css`
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  padding: 0 6px;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--foreground);
  ${typography.normal};
`;

/* A square tool, pressed while its option is on. */
export const toggle = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--tree-row-hover);
  }

  &.active {
    color: var(--accent-color-11);
    background-color: var(--accent-color-4);
  }

  &:focus-visible {
    outline: 1px solid var(--focus);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
    background-color: transparent;
  }
`;

/*
 * The arrow before the fields, as tall as the rows it unfolds, Replace's
 * included, as an editor's find draws it; it faces the reading direction folded.
 */
export const twisty = css`
  align-self: stretch;
  height: auto;
  min-height: 26px;

  [dir='rtl'] &.collapsed {
    transform: scaleX(-1);
  }
`;

export const status = css`
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 22px;
`;

export const count = css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  padding-inline-start: 2px;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--tree-muted);
  font-variant-numeric: tabular-nums;

  &.invalid {
    color: var(--find-replace-error);
  }
`;

export const scopes = css`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

export const scope = css`
  height: 20px;
  padding: 0 8px;
  border: 1px solid var(--explorer-border);
  border-radius: 9999px;
  background: transparent;
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
