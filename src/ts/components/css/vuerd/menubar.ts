import { css } from "lit-element";
import {
  SIZE_FONT,
  SIZE_MENUBAR_HEIGHT,
  SIZE_COLUMN_MARGIN_RIGHT,
  SIZE_INPUT_EDIT_HEIGHT,
  SIZE_COLUMN_HEIGHT,
} from "@src/core/Layout";

export const menubar = css`
  /* =============== menubar ============== */
  .vuerd-menubar {
    width: 100%;
    position: absolute;
    overflow: hidden;
    z-index: 100001000;
    display: flex;
    align-items: center;
    height: ${SIZE_MENUBAR_HEIGHT}px;
    background-color: var(--vuerd-theme-menubar, var(--vuerd-color-menubar));
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .vuerd-menubar > .vuerd-menubar-input {
    margin-left: 20px;
  }
  .vuerd-menubar > .vuerd-menubar-input input {
    outline: none;
    border: none;
    opacity: 0.9;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(--vuerd-theme-menubar, var(--vuerd-color-menubar));
  }
  .vuerd-menubar > .vuerd-menubar-menu {
    cursor: pointer;
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
    margin-left: 10px;
  }
  .vuerd-menubar > .vuerd-menubar-menu.active {
    fill: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  .vuerd-menubar > .vuerd-menubar-menu:hover {
    fill: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }

  .vuerd-grid-filter {
    position: absolute;
    z-index: 100000040;
    right: 190px;
    width: 410px;
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    background-color: var(--vuerd-theme-menubar, var(--vuerd-color-menubar));
    opacity: 0.9;
    fill: #fff0;
  }
  .vuerd-grid-filter:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-grid-filter-header {
    height: 51.41px;
    padding: 0 20px;
    overflow: hidden;
  }
  .vuerd-grid-filter-header h3 {
    display: inline-block;
    margin-right: 10px;
  }
  .vuerd-grid-filter-header .vuerd-grid-filter-radio-editor {
    display: inline-block;
  }
  .vuerd-grid-filter-header .vuerd-button {
    float: right;
    margin-left: 5px;
    margin-block-start: 1em;
    margin-block-end: 1em;
  }
  .vuerd-grid-filter-body {
    padding: 0 20px 20px 20px;
  }
  .vuerd-grid-filter-state {
    height: ${SIZE_COLUMN_HEIGHT}px;
    fill: #fff0;
  }
  .vuerd-grid-filter-state:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-grid-filter-state.select {
    background-color: var(
      --vuerd-theme-column-select,
      var(--vuerd-color-column-select)
    );
  }
  .vuerd-grid-filter-state.draggable {
    opacity: 0.5;
  }
  /* animation flip */
  .vuerd-grid-filter-state-move {
    transition: transform 0.3s;
  }
  vuerd-grid-filter-text-editor,
  .vuerd-grid-filter-body vuerd-grid-filter-radio-editor {
    float: left;
  }
  .vuerd-grid-filter-text-editor {
    width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .vuerd-grid-filter-text-editor,
  .vuerd-grid-filter-radio-editor {
    display: flex;
    vertical-align: middle;
    align-items: center;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(--vuerd-theme-menubar, var(--vuerd-color-menubar));
  }
  input.vuerd-grid-filter-text-editor {
    outline: none;
    border: none;
    opacity: 0.9;
    padding: 1px 0 1px 0;
    height: 17px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
  }
  div.vuerd-grid-filter-text-editor,
  div.vuerd-grid-filter-radio-editor {
    border-bottom: solid #fff0 1.5px;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    cursor: default;
  }
  .vuerd-grid-filter-text-editor.select,
  .vuerd-grid-filter-radio-editor.select {
    background-color: var(
      --vuerd-theme-column-select,
      var(--vuerd-color-column-select)
    );
  }
  .vuerd-grid-filter-text-editor.focus,
  .vuerd-grid-filter-radio-editor.focus {
    border-bottom: solid var(--vuerd-theme-focus, var(--vuerd-color-focus))
      1.5px;
  }
  .vuerd-grid-filter-text-editor.edit,
  .vuerd-grid-filter-radio-editor.edit {
    border-bottom: solid var(--vuerd-theme-edit, var(--vuerd-color-edit)) 1.5px;
  }
  .vuerd-grid-filter-text-editor.placeholder {
    color: var(
      --vuerd-theme-font-placeholder,
      var(--vuerd-color-font-placeholder)
    );
  }
  .vuerd-grid-filter-radio-editor {
    position: relative;
  }
  .vuerd-grid-filter-radio-editor-box {
    position: absolute;
    list-style: none;
    padding: 0;
    margin: 0;
    top: ${SIZE_COLUMN_HEIGHT}px;
    left: 0;
    z-index: 100000000;
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
    background-color: var(--vuerd-theme-menubar, var(--vuerd-color-menubar));
    opacity: 0.9;
  }
  .vuerd-grid-filter-radio-editor-box > li {
    padding: 5px;
    cursor: pointer;
  }
  .vuerd-grid-filter-radio-editor-box > li .icon {
    display: inline-block;
    width: 12px;
  }
  .vuerd-grid-filter-radio-editor-box > li:hover,
  .vuerd-grid-filter-radio-editor-box > li.active {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    fill: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }

  .vuerd-find {
    position: absolute;
    z-index: 100000040;
    right: 190px;
    width: 300px;
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    background-color: var(--vuerd-theme-menubar, var(--vuerd-color-menubar));
    opacity: 0.9;
  }
`;
