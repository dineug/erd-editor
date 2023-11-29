import { css } from '@dineug/r-html';

import { fontSize1, fontSize2, fontSize3 } from '@/styles/typography.styles';

export const button = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 6px;
`;

export const soft = css`
  background-color: var(--accent-color-3);
  color: var(--accent-color-11);

  &:hover {
    background-color: var(--accent-color-4);
  }

  &:active {
    background-color: var(--accent-color-5);
  }
`;

export const size1 = css`
  font-weight: var(--font-weight-medium);
  padding: 0 8px;
  height: 24px;
  ${fontSize1};
`;

export const size2 = css`
  font-weight: var(--font-weight-medium);
  padding: 0 12px;
  height: 32px;
  ${fontSize2};
`;

export const size3 = css`
  font-weight: var(--font-weight-medium);
  padding: 0 16px;
  height: 40px;
  ${fontSize3};
`;
