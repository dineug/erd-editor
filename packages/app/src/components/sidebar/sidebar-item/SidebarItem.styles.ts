import { css } from '@emotion/react';

export const item = css`
  border-radius: var(--radius-2);
  cursor: default;
  height: 32px;

  &[data-selected='true'] {
    background-color: var(--gray-4);
  }

  & > svg {
    cursor: pointer;
    margin-left: 4px;
    visibility: hidden;
  }

  & > .collaborative {
    visibility: hidden;
  }

  &[data-open-menu='true'] {
    & > svg {
      visibility: visible;
    }
  }
`;

export const hover = css`
  &:hover {
    background-color: var(--accent-7);

    & > svg {
      visibility: visible;
    }

    & > .collaborative {
      visibility: visible;
    }
  }
`;

export const padding = css`
  padding: 0 var(--space-3);
`;

export const inputPadding = css`
  padding: 0 var(--space-1);
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
