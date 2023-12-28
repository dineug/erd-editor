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
    margin-left: auto;
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
