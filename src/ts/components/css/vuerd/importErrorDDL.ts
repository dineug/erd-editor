import { css } from "lit-element";
import { SIZE_MENUBAR_HEIGHT } from "@src/core/Layout";

export const importErrorDDL = css`
  /* =============== import error DDL ============== */
  .vuerd-import-error-ddl {
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
  .vuerd-import-error-ddl:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-import-error-ddl-header {
    height: 30px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .vuerd-import-error-ddl-header > h3 {
    display: inline-block;
    margin: 0;
  }
  .vuerd-import-error-ddl-header > .vuerd-button {
    float: right;
  }
  .vuerd-import-error-ddl-body {
    font-family: monospace !important;
    white-space: pre;
    height: calc(100% - 70px);
    overflow: auto;
    box-sizing: border-box;
  }
  .vuerd-import-error-ddl-footer {
    height: 20px;
    margin-top: 10px;
  }
  .vuerd-import-error-ddl-footer > a {
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
`;
