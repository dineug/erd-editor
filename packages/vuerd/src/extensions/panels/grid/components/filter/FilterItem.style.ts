import { SIZE_COLUMN_HEIGHT } from '@/core/layout';
import { css } from '@/core/tagged';

export const FilterItemStyle = css`
  .vuerd-filter-item {
    height: ${SIZE_COLUMN_HEIGHT}px;
    fill: #fff0;
  }

  .vuerd-filter-item:hover {
    fill: var(--vuerd-color-font);
  }

  .vuerd-filter-item.select {
    background-color: var(--vuerd-color-column-select);
  }

  .vuerd-filter-item.draggable {
    opacity: 0.5;
  }

  .vuerd-filter-item > vuerd-filter-radio-editor,
  .vuerd-filter-item > vuerd-input {
    float: left;
  }
`;
