import { SIZE_COLUMN_MARGIN_RIGHT, SIZE_FONT } from '@/core/layout';
import { css } from '@/core/tagged';

export const IndexesStyle = css`
  .vuerd-indexes {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .vuerd-indexes input {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu);
    outline: none;
    border: none;
    opacity: 0.9;
    padding: 1px 0 1px 0;
    height: 23.5px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    border-bottom: solid #fff0 1.5px;
  }
  .vuerd-indexes input:focus {
    border-bottom: solid var(--vuerd-color-edit) 1.5px;
  }
  .vuerd-index {
    fill: #fff0;
    color: var(--vuerd-color-font-active);
  }
  .vuerd-index:hover,
  .vuerd-index-column:hover {
    fill: var(--vuerd-color-font);
  }
  .vuerd-index-column {
    fill: #fff0;
    display: inline-block;
  }
  .vuerd-index-column.draggable {
    opacity: 0.5;
  }
  .vuerd-index-unique {
    display: inline-block;
    cursor: pointer;
    color: var(--vuerd-color-font-placeholder);
  }
  .vuerd-index-unique.checked {
    color: var(--vuerd-color-font-active);
  }
  .vuerd-index-column-name {
    display: inline-block;
    cursor: move;
    padding: 5px;
  }
  .vuerd-index-column-name:hover {
    background-color: var(--vuerd-color-contextmenu-active);
  }
  .vuerd-index-column-name.none-hover:hover {
    background-color: var(--vuerd-color-contextmenu);
  }
  .vuerd-index-column-order {
    display: inline-block;
    cursor: pointer;
  }
  .vuerd-index-add-column {
    display: inline-block;
    position: relative;
  }
  .vuerd-index-add-column-list {
    position: absolute;
    top: 27px;
    left: 0;
    z-index: 100;
    color: var(--vuerd-color-font);
    background-color: var(--vuerd-color-contextmenu);
    opacity: 0.9;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .vuerd-index-add-column-list > li {
    padding: 5px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
  }
  .vuerd-index-add-column-list > li:hover,
  .vuerd-index-add-column-hint.active {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
  }
  .vuerd-index-add-column-list > li:hover .vuerd-index-add-column-hint-mark,
  .vuerd-index-add-column-hint.active .vuerd-index-add-column-hint-mark {
    color: var(--vuerd-color-font-active);
  }
  /* animation flip */
  .vuerd-index-add-column-hint-move {
    transition: transform 0.2s;
  }
  .vuerd-index-column-move {
    transition: transform 0.3s;
  }

  .vuerd-index-add-column-hint-mark {
    color: var(--vuerd-color-edit);
  }
`;
