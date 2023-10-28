import { css } from '@dineug/r-html';

export const key = css`
  fill: transparent;

  &.pk {
    fill: var(--key-pk);
  }

  &.fk {
    fill: var(--key-fk);
  }

  &.pfk {
    fill: var(--key-pfk);
  }
`;
