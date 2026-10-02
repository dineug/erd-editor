import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

/* The section strip under the header, ruled off from the body as the header is from it. */
export const tabs = css`
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  min-height: 48px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--context-menu-border);
  overflow-x: auto;
`;

/* The Settings list item, at the dialog's own size, since the dialog sets none. */
export const tab = css`
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 32px;
  border-radius: 4px;
  cursor: default;
  white-space: nowrap;
  ${typography.normal};

  &:hover {
    background-color: var(--gray-color-3);
    color: var(--active);
  }

  &.selected {
    background-color: var(--context-menu-select);
    color: var(--active);
  }
`;
