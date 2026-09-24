import { css } from '@emotion/react';

import { rowButton } from '@/components/sidebar/sidebar-item/sidebar-item-view/SidebarItemView.styles';

export const addButton = css`
  ${rowButton};
  flex: 1 1 auto;
`;

// Radix pulls a ghost button out by its padding; here it keeps its 28px box.
export const menuButton = css`
  flex: none;
  margin: 0;
`;

export const email = css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const signOut = css`
  flex: none;
  margin: 0;
`;

export const listNote = css`
  padding: 6px 12px;
`;
