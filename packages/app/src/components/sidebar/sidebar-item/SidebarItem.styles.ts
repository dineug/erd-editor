import { css } from '@emotion/react';

// The row's buttons stay hidden, and so out of the Tab order, until the row is
// hovered, holds focus or has its menu open.
export const item = css`
  border-radius: var(--radius-2);
  cursor: default;
  height: 32px;
  padding-right: var(--space-2);

  &[data-selected='true'] {
    background-color: var(--gray-4);
  }

  & > .item-menu {
    margin: 0 0 0 4px;
    visibility: hidden;
  }

  & > .collaborative {
    visibility: hidden;
  }

  &:focus-within,
  &[data-open-menu='true'] {
    & > .item-menu,
    & > .collaborative {
      visibility: visible;
    }
  }
`;

export const hover = css`
  &:hover {
    background-color: var(--accent-7);

    & > .item-menu {
      visibility: visible;
    }

    & > .collaborative {
      visibility: visible;
    }
  }
`;

export const select = css`
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  padding: 0 var(--space-2) 0 var(--space-3);
  border-radius: var(--radius-2);
  cursor: default;

  &:focus-visible {
    outline: 2px solid var(--focus-8);
    outline-offset: -2px;
  }
`;

export const menuTrigger = css`
  flex: none;
`;

export const input = css`
  margin-left: var(--space-1);
`;

export const text = css`
  width: 100%;
`;

export const ellipsis = css`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// A ghost button drawn as a list row, its icon where the names start; Radix
// would pull it out by its padding and fit its height to the label.
export const rowButton = css`
  box-sizing: border-box;
  height: 32px;
  margin: 0;
  padding: 0 var(--space-3);
  gap: var(--space-2);
  justify-content: flex-start;
`;
