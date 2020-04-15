import { css } from "lit-element";

export const Layout = css`
  ul,
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .vuerd-editor {
    position: relative;
    overflow: hidden;

    font-size: 13px;
    font-family: "Noto Sans", "Cascadia Code", "JetBrains Mono", "D2Coding",
      "Consolas", sans-serif;
  }

  .vuerd-erd {
    position: relative;
    overflow: hidden;
  }

  .vuerd-canvas {
    position: relative;
  }

  .vuerd-canvas-svg {
    position: absolute;
    z-index: 1;
  }

  .vuerd-table {
    position: absolute;
    opacity: 0.9;
    padding: 10px;
    font-size: 13px;
  }
  .vuerd-table .vuerd-table-header-top {
    overflow: hidden;
  }
  .vuerd-table .vuerd-table-header-top .vuerd-circle-button {
    margin-left: 5px;
    float: right;
  }
  .vuerd-table .vuerd-table-header-body {
    height: 30px;
  }

  input.vuerd-input-edit {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    outline: none;
    border: none;
    opacity: 0.9;
    font-size: 13px;
    font-family: "Noto Sans", "Cascadia Code", "JetBrains Mono", "D2Coding",
      "Consolas", sans-serif;
  }
  div.vuerd-input-edit,
  .vuerd-column-not-null {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    border-bottom: solid #fff0 1.5px;
    height: 18px;
    cursor: default;
  }
  .vuerd-column-key {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
  }
  .vuerd-column {
    height: 19.5px;
  }

  .vuerd-circle-button {
    width: 17px;
    height: 17px;
    font-size: 0.7em;
    cursor: pointer;
    border-radius: 50%;
    display: inline-flex;
    justify-content: center;
    align-items: center;
  }

  .vuerd-column-button-remove {
    cursor: pointer;
  }

  .vuerd-contextmenu {
    position: fixed;
    z-index: 100000000;
    opacity: 0.9;
  }
  .vuerd-contextmenu > li {
    padding: 10px 5px 10px 10px;
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
  }
  .vuerd-contextmenu > li > span {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 10px;
  }
  .vuerd-contextmenu > li > span.icon,
  .vuerd-contextmenu > li > span.icon > img {
    width: 16px;
  }
  .vuerd-contextmenu > li > span.name {
    width: 110px;
  }
  .vuerd-contextmenu > li > span.keymap {
    width: 70px;
    display: inline-block;
    padding-right: 0;
  }
  .vuerd-contextmenu > li > span.arrow {
    width: 13px;
    padding-right: 0;
  }
`;

const ratioWidth = 16;
const ratioHeight = 9;
export const defaultWidth = 1200;
export const defaultHeight = (defaultWidth / ratioWidth) * ratioHeight;
