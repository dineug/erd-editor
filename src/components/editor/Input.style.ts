import { css } from '@/core/tagged';
import {
  SIZE_FONT,
  SIZE_INPUT_EDIT_HEIGHT,
  SIZE_COLUMN_MARGIN_RIGHT,
} from '@/core/layout';

export const InputStyle = css`
  .vuerd-input {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-table);
  }

  input.vuerd-input {
    outline: none;
    border: none;
    opacity: 0.9;
    padding: 1px 0 1px 0;
    height: 17px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
  }

  div.vuerd-input {
    border-bottom: solid #fff0 1.5px;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    cursor: default;
  }

  .vuerd-input > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vuerd-input.select {
    background-color: var(--vuerd-color-column-select);
  }

  .vuerd-input.active {
    background-color: var(--vuerd-color-column-active);
  }

  .vuerd-input.focus {
    border-bottom: solid var(--vuerd-color-focus) 1.5px;
  }

  .vuerd-input.edit {
    border-bottom: solid var(--vuerd-color-edit) 1.5px;
  }

  .vuerd-input.placeholder {
    color: var(--vuerd-color-font-placeholder);
  }
`;
