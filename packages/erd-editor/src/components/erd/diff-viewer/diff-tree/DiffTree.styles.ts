import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

export const root = css`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  border-right: 1px solid var(--explorer-border);
  background-color: var(--tree-background);
  color: var(--foreground);
`;

export const header = css`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  padding: 6px 8px;
  border-bottom: 1px solid var(--explorer-border);
`;

export const filter = css`
  flex: 1 1 auto;
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  box-sizing: border-box;
  border: 1px solid var(--explorer-border);
  border-radius: 4px;
  outline: none;
  background: transparent;
  color: var(--foreground);
  ${typography.normal};

  &:focus {
    border-color: var(--focus);
  }
`;

export const body = css`
  flex: 1 1 auto;
  min-height: 0;
`;

export const empty = css`
  padding: 12px;
  color: var(--tree-muted);
  ${typography.paragraph};
`;

export const sash = css`
  position: absolute;
  top: 0;
  right: -3px;
  bottom: 0;
  width: 5px;
  z-index: 1;
`;

export const rowIcon = css`
  display: inline-flex;
  flex: 0 0 auto;
  margin-inline-end: 6px;
  color: var(--tree-muted);
`;

/* A name in the colour of what happened to it, struck through where it is gone. */
export const name = css`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.added {
    color: var(--diff-insert-foreground);
  }

  &.modified {
    color: var(--diff-modify-foreground);
  }

  &.deleted {
    color: var(--diff-delete-foreground);
    text-decoration: line-through;
  }

  &.renamed {
    color: var(--diff-rename-foreground);
  }

  &.unnamed {
    font-style: italic;
  }
`;

export const count = css`
  flex: 0 0 auto;
  margin-inline-start: 6px;
  font-size: 11px;
  color: var(--tree-muted);
`;

/* The letter at the row's end, in the colour its name takes; a tilde in the changed colour. */
export const status = css`
  flex: 0 0 auto;
  margin-inline-start: auto;
  padding-inline: 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--diff-modify-foreground);

  &.added {
    color: var(--diff-insert-foreground);
  }

  &.deleted {
    color: var(--diff-delete-foreground);
  }

  &.renamed {
    color: var(--diff-rename-foreground);
  }
`;
