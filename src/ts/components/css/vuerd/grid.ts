import { css } from "lit-element";
import { SIZE_FONT, SIZE_MENUBAR_HEIGHT } from "@src/core/Layout";

export const grid = css`
  /* =============== grid ============== */
  .vuerd-grid {
    height: calc(100% - ${SIZE_MENUBAR_HEIGHT}px);
    margin-top: ${SIZE_MENUBAR_HEIGHT}px;
    background-color: var(--vuerd-theme-table, var(--vuerd-color-table));
  }
  .vuerd-grid .vuerd-grid-text {
    width: 100%;
    height: 100%;
    padding: 7px 6px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    border-bottom: solid #fff0 1.5px;
    box-sizing: border-box;
  }
  .vuerd-grid .vuerd-grid-text.placeholder {
    color: var(
      --vuerd-theme-font-placeholder,
      var(--vuerd-color-font-placeholder)
    );
  }
  .vuerd-grid input.vuerd-grid-input {
    width: 100%;
    height: 100%;
    outline: none;
    border: none;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(--vuerd-theme-table, var(--vuerd-color-table));
    border-bottom: solid var(--vuerd-theme-edit, var(--vuerd-color-edit)) 2px;
  }
  .vuerd-grid-column-option-editor {
    position: absolute;
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
    opacity: 0.9;
    list-style: none;
    padding: 0;
    margin: 0;
    z-index: 100;
  }
  .vuerd-grid-column-option-editor > li > input {
    outline: none;
    border: none;
    margin-right: 5px;
  }
  .vuerd-grid-column-option-editor > li {
    display: flex;
    vertical-align: middle;
    align-items: center;
    padding: 5px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
  }
  .vuerd-grid-column-option-editor > li:hover,
  .vuerd-grid-column-option-editor > li.active {
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-grid-column-data-type-editor {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .vuerd-grid-column-data-type-hint {
    position: absolute;
    top: 41px;
    left: 0;
    z-index: 100;
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
    opacity: 0.9;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .vuerd-grid-column-data-type-hint > li {
    padding: 5px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
  }
  .vuerd-grid-column-data-type-hint > li:hover,
  .vuerd-grid-data-type-hint.active {
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-grid-column-data-type-hint > li:hover .vuerd-mark,
  .vuerd-grid-data-type-hint.active .vuerd-mark {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  /* animation flip */
  .vuerd-grid-data-type-hint-move {
    transition: transform 0.2s;
  }
`;
