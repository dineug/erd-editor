import { css } from "lit-element";
import { SIZE_MENUBAR_HEIGHT } from "@src/core/Layout";

export const help = css`
  /* =============== help ============== */
  .vuerd-help {
    position: absolute;
    top: ${SIZE_MENUBAR_HEIGHT}px;
    height: calc(100% - ${SIZE_MENUBAR_HEIGHT}px);
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    opacity: 0.9;
    background-color: var(--vuerd-theme-help, var(--vuerd-color-help));
    z-index: 100000050;
    fill: #fff0;
  }
  .vuerd-help:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-help-header {
    padding: 0 20px;
  }
  .vuerd-help-header > h3 {
    display: inline-block;
  }
  .vuerd-help-header > .vuerd-button {
    float: right;
    margin-block-start: 1em;
    margin-block-end: 1em;
  }
  .vuerd-help-body {
    height: calc(100% - 51.41px);
    overflow: auto;
    padding: 0 20px 20px 20px;
    box-sizing: border-box;
  }
`;
