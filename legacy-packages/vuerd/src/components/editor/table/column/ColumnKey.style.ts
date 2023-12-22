import { SIZE_COLUMN_MARGIN_RIGHT } from '@/core/layout';
import { css } from '@/core/tagged';

export const ColumnKeyStyle = css`
  .vuerd-column-key {
    display: flex;
    vertical-align: middle;
    align-items: center;
    fill: #fff0;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
  }

  .vuerd-column-key.pk {
    fill: var(--vuerd-color-key-pk);
  }

  .vuerd-column-key.fk {
    fill: var(--vuerd-color-key-fk);
  }

  .vuerd-column-key.pfk {
    fill: var(--vuerd-color-key-pfk);
  }
`;
