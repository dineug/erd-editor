import { css } from '@dineug/r-html';

export const root = css`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  border-right: 1px solid var(--explorer-border);
  background-color: var(--explorer-background);
  color: var(--foreground);
`;

export const header = css`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 2px;
  height: 30px;
  padding-inline: 10px 4px;
`;

export const title = css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--tree-muted);
`;

export const tool = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    background-color: var(--tree-row-hover);
    color: var(--active);
  }

  &:focus-visible {
    outline: 1px solid var(--input-active);
  }
`;

export const body = css`
  flex: 1 1 auto;
  min-height: 0;
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

  &.pk {
    color: var(--key-pk);
  }

  &.fk {
    color: var(--key-fk);
  }

  &.pfk {
    color: var(--key-pfk);
  }
`;

export const name = css`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.unnamed {
    font-style: italic;
    color: var(--tree-muted);
  }
`;

/* It gives way before the name does, so a long type or column list is cut first. */
export const muted = css`
  flex: 0 1000 auto;
  min-width: 0;
  margin-inline-start: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--tree-muted);
`;

export const count = css`
  flex: 0 0 auto;
  margin-inline-start: auto;
  padding-inline: 8px;
  font-size: 11px;
  color: var(--tree-muted);
`;

export const dot = css`
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-inline: 4px 8px;
  border-radius: 50%;
  background-color: var(--tree-muted);
`;

export const mark = css`
  border-radius: 2px;
  color: var(--foreground);
  background-color: var(--tree-match);
`;
