import { SIZE_FONT } from '@/core/layout';
import { css } from '@/core/tagged';

export const ColumnOptionEditorStyle = css`
  .vuerd-grid-column-option-editor {
    position: absolute;
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu);
    opacity: 0.9;
    list-style: none;
    padding: 0;
    margin: 0;
    z-index: 100;
  }

  .vuerd-grid-column-option-editor > li > input {
    outline: none;
    border: none;
    margin-right: 5px;
    cursor: pointer;
  }

  .vuerd-grid-column-option-editor > li {
    display: flex;
    vertical-align: middle;
    align-items: center;
    padding: 5px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
  }

  .vuerd-grid-column-option-editor > li:hover,
  .vuerd-grid-column-option-editor > li.active {
    background-color: var(--vuerd-color-contextmenu-active);
  }
`;
