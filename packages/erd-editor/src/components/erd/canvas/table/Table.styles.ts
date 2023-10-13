import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

export const root = css`
  position: absolute;
  background-color: var(--table-background);
  padding: 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  fill: transparent;
  color: transparent;
  ${typography.paragraph};

  &:hover {
    fill: var(--foreground);
    color: var(--foreground);
  }
`;
