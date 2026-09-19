import { css } from '@emotion/react';

import { rowButton } from '@/components/sidebar/sidebar-item/SidebarItem.styles';

// Border-box, or the ghost padding pushes the button past the sidebar's edge
// and focusing it scrolls the whole sidebar sideways.
export const trigger = css`
  ${rowButton};
  width: 100%;
`;

// Without the ghost margins, which would pull the pair over the name.
export const rowAction = css`
  flex: none;
  margin: 0;
`;

// Radix sizes the scrolled content to fit it, so a long name would push the
// row's buttons out of the dialog instead of giving way to an ellipsis.
export const list = css`
  max-height: 320px;

  & .rt-ScrollAreaViewport > * {
    width: 100%;
  }
`;

export const rows = css`
  margin: 0;
  padding: 0;
  list-style: none;
`;

export const item = css`
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);

  &:hover {
    background-color: var(--gray-3);
  }
`;

export const itemText = css`
  flex: 1;
  min-width: 0;
`;

export const ellipsis = css`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
