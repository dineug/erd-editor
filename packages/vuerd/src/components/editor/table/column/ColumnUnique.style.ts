import {
  SIZE_COLUMN_MARGIN_RIGHT,
  SIZE_INPUT_EDIT_HEIGHT,
} from '@/core/layout';
import { css } from '@/core/tagged';

export const ColumnUniqueStyle = css`
  .vuerd-column-unique {
    display: flex;
    vertical-align: middle;
    align-items: center;
    border-bottom: solid #fff0 1.5px;
    cursor: default;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-color-font-placeholder);
  }

  .vuerd-column-unique.focus {
    border-bottom: solid var(--vuerd-color-focus) 1.5px;
  }

  .vuerd-column-unique.checked {
    color: var(--vuerd-color-font-active);
  }
`;
