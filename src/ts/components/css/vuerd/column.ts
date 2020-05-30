import { css } from "lit-element";
import {
  SIZE_FONT,
  SIZE_COLUMN_HEIGHT,
  SIZE_INPUT_EDIT_HEIGHT,
  SIZE_COLUMN_MARGIN_RIGHT,
} from "@src/core/Layout";

export const column = css`
  /* =============== column ============== */
  .vuerd-column {
    height: ${SIZE_COLUMN_HEIGHT}px;
    fill: #fff0;
  }
  .vuerd-column:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-column.select {
    background-color: var(
      --vuerd-theme-column-select,
      var(--vuerd-color-column-select)
    );
  }
  .vuerd-column.active {
    background-color: var(
      --vuerd-theme-column-active,
      var(--vuerd-color-column-active)
    );
  }
  .vuerd-column.draggable {
    opacity: 0.5;
  }
  /* animation flip */
  .vuerd-column-move {
    transition: transform 0.3s;
  }

  vuerd-input-edit,
  vuerd-column-key,
  vuerd-column-not-null,
  vuerd-column-data-type {
    float: left;
  }
  .vuerd-input-edit {
    display: flex;
    vertical-align: middle;
    align-items: center;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(--vuerd-theme-table, var(--vuerd-color-table));
  }
  input.vuerd-input-edit {
    outline: none;
    border: none;
    opacity: 0.9;
    padding: 1px 0 1px 0;
    height: 17px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
  }
  div.vuerd-input-edit {
    border-bottom: solid #fff0 1.5px;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    cursor: default;
  }
  .vuerd-input-edit.select {
    background-color: var(
      --vuerd-theme-column-select,
      var(--vuerd-color-column-select)
    );
  }
  .vuerd-input-edit.active {
    background-color: var(
      --vuerd-theme-column-active,
      var(--vuerd-color-column-active)
    );
  }
  .vuerd-input-edit.focus {
    border-bottom: solid var(--vuerd-theme-focus, var(--vuerd-color-focus))
      1.5px;
  }
  .vuerd-input-edit.edit {
    border-bottom: solid var(--vuerd-theme-edit, var(--vuerd-color-edit)) 1.5px;
  }
  .vuerd-input-edit.placeholder {
    color: var(
      --vuerd-theme-font-placeholder,
      var(--vuerd-color-font-placeholder)
    );
  }

  .vuerd-column-key {
    display: flex;
    vertical-align: middle;
    align-items: center;
    fill: #fff0;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
  }
  .vuerd-column-key.pk {
    fill: var(--vuerd-theme-key-pk, var(--vuerd-color-key-pk));
  }
  .vuerd-column-key.fk {
    fill: var(--vuerd-theme-key-fk, var(--vuerd-color-key-fk));
  }
  .vuerd-column-key.pfk {
    fill: var(--vuerd-theme-key-pfk, var(--vuerd-color-key-pfk));
  }

  .vuerd-column-not-null {
    display: flex;
    vertical-align: middle;
    align-items: center;
    border-bottom: solid #fff0 1.5px;
    cursor: default;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  .vuerd-column-not-null.focus {
    border-bottom: solid var(--vuerd-theme-focus, var(--vuerd-color-focus))
      1.5px;
  }

  .vuerd-column-data-type {
    display: flex;
    vertical-align: middle;
    align-items: center;
    position: relative;
  }
  vuerd-column-data-type-hint {
    position: absolute;
  }
  .vuerd-column-data-type-hint {
    position: absolute;
    opacity: 0.9;
    top: 11px;
    left: 0;
    z-index: 100000000;
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .vuerd-column-data-type-hint > li {
    padding: 5px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
  }
  .vuerd-column-data-type-hint > li:hover,
  .vuerd-data-type-hint.active {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-column-data-type-hint > li:hover .vuerd-mark,
  .vuerd-data-type-hint.active .vuerd-mark {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  /* animation flip */
  .vuerd-data-type-hint-move {
    transition: transform 0.2s;
  }
  .vuerd-mark {
    color: var(--vuerd-theme-edit, var(--vuerd-color-edit));
  }
`;
