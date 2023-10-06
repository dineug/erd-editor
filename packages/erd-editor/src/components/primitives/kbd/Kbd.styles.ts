import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

export const root = css`
  display: flex;
`;

export const kbd = css`
  display: inline-block;

  padding-left: 0.5em;
  padding-right: 0.5em;
  padding-bottom: 0.05em;
  margin-right: 4px;
  ${typography.paragraph};

  white-space: nowrap;
  color: var(--foreground);
  border: 1px solid var(--foreground);
  border-radius: 3px;

  &:last-child {
    margin-right: 0;
  }
`;
