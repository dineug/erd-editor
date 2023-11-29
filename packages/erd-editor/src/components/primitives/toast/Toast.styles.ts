import { css } from '@dineug/r-html';

import { fontSize2, typography } from '@/styles/typography.styles';

export const root = css`
  display: flex;
  align-items: center;
  border-radius: 6px;
  width: fit-content;
  padding: 15px;
  background-color: var(--toast-background);
  border: 1px solid var(--toast-border);
`;

export const textWrap = css`
  word-break: break-all;

  & > div {
    margin-bottom: 5px;
  }

  & > div:last-child {
    margin-bottom: 0;
  }
`;

export const title = css`
  color: var(--active);
  font-weight: var(--font-weight-medium);
  ${fontSize2};
`;

export const description = css`
  ${typography.paragraph};
`;

export const action = css`
  display: flex;
  margin-left: 15px;

  & > button {
    margin-left: 8px;
  }

  & > button:first-child {
    margin-left: 0;
  }
`;
