import { css } from "lit-element";
import { SIZE_MENUBAR_HEIGHT, SIZE_FONT } from "@src/core/Layout";

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
`;
