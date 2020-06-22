import { css } from "lit-element";
import {
  SIZE_MENUBAR_HEIGHT,
  SIZE_COLUMN_MARGIN_RIGHT,
  SIZE_FONT,
} from "@src/core/Layout";

export const tableProperties = css`
  /* =============== tableProperties ============== */
  .vuerd-table-properties {
    position: absolute;
    top: ${SIZE_MENUBAR_HEIGHT}px;
    height: calc(100% - ${SIZE_MENUBAR_HEIGHT}px);
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    opacity: 0.9;
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
    z-index: 100000050;
    fill: #fff0;
    padding: 20px;
    box-sizing: border-box;
  }
  .vuerd-table-properties:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-table-properties-header {
    height: 30px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .vuerd-table-properties-header > h3 {
    display: inline-block;
    margin: 0;
  }
  .vuerd-table-properties-header > .vuerd-button {
    float: right;
  }
  .vuerd-table-properties-body {
    height: calc(100% - 40px);
    overflow: auto;
    box-sizing: border-box;
  }
  .vuerd-table-properties-body tbody tr td {
    padding-right: 20px;
    padding-bottom: 10px;
  }
  .vuerd-table-properties-tab {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    margin-bottom: 10px;
  }
  .vuerd-table-properties-tab > li {
    padding: 10px;
    box-sizing: border-box;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
    white-space: nowrap;
    display: inline-block;
  }
  .vuerd-table-properties-tab > li:hover {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-table-properties-tab > li.active {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }

  /* =============== tab indexes ============== */
  .vuerd-tab-indexes input {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
    outline: none;
    border: none;
    opacity: 0.9;
    padding: 1px 0 1px 0;
    height: 23.5px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    border-bottom: solid #fff0 1.5px;
  }
  .vuerd-tab-indexes input:focus {
    border-bottom: solid var(--vuerd-theme-edit, var(--vuerd-color-edit)) 1.5px;
  }
  .vuerd-index {
    fill: #fff0;
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  .vuerd-index:hover,
  .vuerd-index-column:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
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
    color: var(
      --vuerd-theme-font-placeholder,
      var(--vuerd-color-font-placeholder)
    );
  }
  .vuerd-index-unique.checked {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  .vuerd-index-column-name {
    display: inline-block;
    cursor: move;
    padding: 5px;
  }
  .vuerd-index-column-name:hover {
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-index-column-name.none-hover:hover {
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
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
    top: 20.5px;
    left: 0;
    z-index: 100;
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
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
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-index-add-column-list > li:hover .vuerd-mark,
  .vuerd-index-add-column-hint.active .vuerd-mark {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  /* animation flip */
  .vuerd-index-add-column-hint-move {
    transition: transform 0.2s;
  }
  .vuerd-index-column-move {
    transition: transform 0.3s;
  }

  /* =============== tab SQL, GeneratorCode ============== */
  .vuerd-tab-sql,
  .vuerd-tab-generator-code {
    height: calc(100% - 87px);
    white-space: pre;
    box-sizing: border-box;
    background-color: #23241f;
    overflow: auto;
    font-family: monospace !important;
    outline: none;
  }
`;
