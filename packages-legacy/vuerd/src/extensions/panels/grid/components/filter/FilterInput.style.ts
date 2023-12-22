import {
  SIZE_COLUMN_MARGIN_RIGHT,
  SIZE_FONT,
  SIZE_INPUT_EDIT_HEIGHT,
} from '@/core/layout';
import { css } from '@/core/tagged';

export const FilterInputStyle = css`
  .vuerd-filter-input {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-menubar);
  }

  input.vuerd-filter-input {
    outline: none;
    border: none;
    opacity: 0.9;
    padding: 1px 0 1px 0;
    height: 17px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
  }

  div.vuerd-filter-input {
    border-bottom: solid #fff0 1.5px;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    cursor: default;
  }

  .vuerd-filter-input > span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vuerd-filter-input.select {
    background-color: var(--vuerd-color-column-select);
  }

  .vuerd-filter-input.active {
    background-color: var(--vuerd-color-column-active);
  }

  .vuerd-filter-input.focus {
    border-bottom: solid var(--vuerd-color-focus) 1.5px;
  }

  .vuerd-filter-input.edit {
    border-bottom: solid var(--vuerd-color-edit) 1.5px;
  }

  .vuerd-filter-input.placeholder {
    color: var(--vuerd-color-font-placeholder);
  }
`;
