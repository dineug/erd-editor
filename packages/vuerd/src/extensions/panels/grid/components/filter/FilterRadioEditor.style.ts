import {
  SIZE_COLUMN_MARGIN_RIGHT,
  SIZE_FONT,
  SIZE_INPUT_EDIT_HEIGHT,
} from '@/core/layout';
import { css } from '@/core/tagged';

export const FilterRadioEditorStyle = css`
  .vuerd-filter-radio-editor {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    position: relative;
  }

  .vuerd-group-value {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-menubar);
    border-bottom: solid #fff0 1.5px;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    cursor: default;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vuerd-group-value.focus {
    border-bottom: solid var(--vuerd-color-focus) 1.5px;
  }

  .vuerd-group-value.edit {
    border-bottom: solid var(--vuerd-color-edit) 1.5px;
  }

  .vuerd-group-value.placeholder {
    color: var(--vuerd-color-font-placeholder);
  }

  .vuerd-group-value.select {
    background-color: var(--vuerd-color-column-select);
  }

  .vuerd-filter-radio-group {
    position: absolute;
    z-index: 1;
    opacity: 0.9;
    top: 20.5px;
    left: 0;
    color: var(--vuerd-color-font);
    background-color: var(--vuerd-color-menubar);
    list-style: none;
    padding: 0;
    margin: 0;
    white-space: nowrap;
  }

  .vuerd-filter-radio-group > li {
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
    display: flex;
    align-items: center;
  }

  .vuerd-filter-radio-group > li:hover,
  .vuerd-filter-radio-group > li.active {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
  }

  .vuerd-filter-radio-group > li > input {
    margin: 0 3px 0 0;
    pointer-events: none;
  }

  .vuerd-filter-radio-group > li > label {
    flex-grow: 1;
    padding: 5px 5px 5px 0;
    pointer-events: none;
  }
`;
