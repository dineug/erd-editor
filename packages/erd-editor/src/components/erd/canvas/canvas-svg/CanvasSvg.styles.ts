import { css } from '@dineug/r-html';

export const root = css`
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;

  .relationship {
    stroke: var(--key-fk);
  }

  .relationship.identification {
    stroke: var(--key-pfk);
  }

  .relationship:hover {
    stroke: var(--relationship-hover);
  }
`;
