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
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
    z-index: 100000050;
    fill: #fff0;
    padding: 20px;
    box-sizing: border-box;
  }
  .vuerd-help:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-help-header {
    height: 30px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .vuerd-help-header > h3 {
    display: inline-block;
    margin: 0;
  }
  .vuerd-help-header > .vuerd-button {
    float: right;
  }
  .vuerd-help-body {
    height: calc(100% - 40px);
    overflow: auto;
    box-sizing: border-box;
  }
`;
