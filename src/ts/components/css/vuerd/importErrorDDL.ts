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
    background-color: var(--vuerd-theme-help, var(--vuerd-color-help));
    z-index: 100000050;
    fill: #fff0;
    padding: 0 20px;
  }
  .vuerd-import-error-ddl:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-import-error-ddl-header {
    height: 51.41px;
    overflow: hidden;
  }
  .vuerd-import-error-ddl-header > h3 {
    display: inline-block;
  }
  .vuerd-import-error-ddl-header > .vuerd-button {
    float: right;
    margin-block-start: 1em;
    margin-block-end: 1em;
  }
  .vuerd-import-error-ddl-body {
    font-family: monospace !important;
    white-space: pre;
    height: calc(100% - 108.41px);
    overflow: auto;
    box-sizing: border-box;
  }
  .vuerd-import-error-ddl-footer {
    padding: 20px;
  }
  .vuerd-import-error-ddl-footer > a {
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
`;
