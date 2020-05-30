import { css } from "lit-element";
import { SIZE_MENUBAR_HEIGHT } from "@src/core/Layout";

export const setting = css`
  /* =============== setting ============== */
  .vuerd-setting {
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
  .vuerd-setting:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-setting-header {
    height: 30px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .vuerd-setting-header > h3 {
    display: inline-block;
    margin: 0;
  }
  .vuerd-setting-header > .vuerd-button {
    float: right;
  }
  .vuerd-setting-body {
    height: calc(100% - 40px);
    overflow: auto;
    box-sizing: border-box;
  }
  .vuerd-setting-body tbody tr td {
    padding-right: 20px;
    padding-bottom: 10px;
  }

  /* =============== switch ============== */
  .vuerd-switch {
    position: relative;
    display: inline-block;
    width: 37.5px;
    height: 22.5px;
    overflow: hidden;
  }
  .vuerd-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .vuerd-switch > .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(
      --vuerd-theme-font-placeholder,
      var(--vuerd-color-font-placeholder)
    );
    transition: 0.3s;
  }
  .vuerd-switch > .slider:before {
    position: absolute;
    content: "";
    height: 15px;
    width: 15px;
    left: 3.75px;
    bottom: 3.75px;
    background-color: var(
      --vuerd-theme-font-active,
      var(--vuerd-color-font-active)
    );
    transition: 0.3s;
  }
  .vuerd-switch > input:checked + .slider {
    background-color: var(--vuerd-theme-focus, var(--vuerd-color-focus));
  }
  .vuerd-switch > input:focus + .slider {
    box-shadow: 0 0 1px var(--vuerd-theme-focus, var(--vuerd-color-focus));
  }
  .vuerd-switch > input:checked + .slider:before {
    transform: translateX(15px);
  }
  .vuerd-switch > .slider.round {
    border-radius: 34px;
  }
  .vuerd-switch > .slider.round:before {
    border-radius: 50%;
  }

  .vuerd-column-order {
    cursor: move;
    box-sizing: border-box;
    padding: 5px;
  }
  .vuerd-column-order:hover {
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-column-order.draggable {
    opacity: 0.5;
  }
  .vuerd-column-order.none-hover:hover {
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
  }
  /* animation flip */
  .vuerd-column-order-move {
    transition: transform 0.3s;
  }
`;
