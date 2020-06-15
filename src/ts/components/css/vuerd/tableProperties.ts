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

  /* =============== indexes ============== */
  .vuerd-indexes input {
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
    height: 17px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    border-bottom: solid #fff0 1.5px;
  }
  .vuerd-indexes input:focus {
    border-bottom: solid var(--vuerd-theme-edit, var(--vuerd-color-edit)) 1.5px;
  }
`;
