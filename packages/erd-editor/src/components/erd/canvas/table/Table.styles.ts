import { css } from '@dineug/r-html';

import { TABLE_PADDING } from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

export const root = css`
  position: absolute;
  background-color: var(--table-background);
  padding: ${TABLE_PADDING}px;
  border-radius: 6px;
  border: 1px solid transparent;
  fill: transparent;
  color: transparent;
  ${typography.paragraph};

  &:hover {
    fill: var(--foreground);
    color: var(--foreground);
  }

  &[selected] {
    border: 1px solid var(--table-select);
  }
`;
