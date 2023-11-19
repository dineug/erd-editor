import { css } from '@dineug/r-html';

export const name = css`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  word-break: break-all;
  color: var(--active);
  font-weight: var(--font-weight-bold);

  &.isEmptyName {
    color: var(--placeholder);
  }
`;
