import { SIZE_COLUMN_HEIGHT } from '@/core/layout';
import { css } from '@/core/tagged';

export const ColumnStyle = css`
  .vuerd-column {
    height: ${SIZE_COLUMN_HEIGHT}px;
    fill: #fff0;
  }

  .vuerd-column:hover {
    fill: var(--vuerd-color-font);
  }

  .vuerd-column.select {
    background-color: var(--vuerd-color-column-select);
  }

  .vuerd-column.active {
    background-color: var(--vuerd-color-column-active);
  }

  .vuerd-column.draggable {
    opacity: 0.5;
  }

  .vuerd-column > vuerd-icon,
  .vuerd-column > vuerd-input,
  vuerd-column-key,
  vuerd-column-not-null,
  vuerd-column-data-type,
  vuerd-column-auto-increment,
  vuerd-column-unique {
    float: left;
  }
`;
