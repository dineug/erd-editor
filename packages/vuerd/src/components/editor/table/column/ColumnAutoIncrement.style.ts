import { css } from '@/core/tagged';
import {
  SIZE_INPUT_EDIT_HEIGHT,
  SIZE_COLUMN_MARGIN_RIGHT,
} from '@/core/layout';

export const ColumnAutoIncrementStyle = css`
  .vuerd-column-auto-increment {
    display: flex;
    vertical-align: middle;
    align-items: center;
    border-bottom: solid #fff0 1.5px;
    cursor: default;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-color-font-placeholder);
  }

  .vuerd-column-auto-increment.focus {
    border-bottom: solid var(--vuerd-color-focus) 1.5px;
  }

  .vuerd-column-auto-increment.checked {
    color: var(--vuerd-color-font-active);
  }
`;
