import { css } from "lit-element";
import { SIZE_FONT, SIZE_CONTEXTMENU_HEIGHT } from "@src/core/Layout";

export const contextmenu = css`
  /* =============== contextmenu ============== */
  .vuerd-contextmenu {
    position: fixed;
    z-index: 100000060;
    opacity: 0.9;
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .vuerd-contextmenu > li {
    height: ${SIZE_CONTEXTMENU_HEIGHT}px;
    padding: 10px 5px 10px 10px;
    box-sizing: border-box;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
    white-space: nowrap;
  }
  .vuerd-contextmenu > li:hover {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    fill: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-contextmenu > li > span {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 5px;
  }
  .vuerd-contextmenu > li > span.icon,
  .vuerd-contextmenu > li > span.icon > img {
    width: 16px;
  }
  .vuerd-contextmenu > li > span.name {
    width: 110px;
    height: 17px;
  }
  .vuerd-contextmenu > li > span.keymap {
    width: 85px;
    display: inline-block;
    padding-right: 0;
  }
  .vuerd-contextmenu > li > span.arrow {
    width: 13px;
    padding-right: 0;
  }
`;
