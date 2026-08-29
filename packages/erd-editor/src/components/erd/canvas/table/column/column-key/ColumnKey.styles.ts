import { css } from '@dineug/r-html';

export const key = css`
  color: transparent;

  &.pk {
    color: var(--key-pk);
  }

  &.fk {
    color: var(--key-fk);
  }

  &.pfk {
    color: var(--key-pfk);
  }
`;
