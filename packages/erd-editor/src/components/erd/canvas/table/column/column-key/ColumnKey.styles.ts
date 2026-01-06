import { css } from '@dineug/r-html';

export const keyContainer = css`
  display: flex;
  align-items: center;
  gap: 4px;
`;

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

export const akLabel = css`
  font-size: 10px;
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
`;
