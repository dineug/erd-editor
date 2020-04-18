import { css } from "lit-element";
import {
  SIZE_FONT,
  SIZE_SASH,
  SIZE_COLUMN_HEIGHT,
  SIZE_INPUT_EDIT_HEIGHT,
  SIZE_TABLE_PADDING,
  SIZE_TABLE_HEADER_BODY_HEIGHT,
  SIZE_MEMO_PADDING,
} from "@src/core/Layout";

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
    font-size: ${SIZE_FONT}px;
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
    padding: ${SIZE_TABLE_PADDING}px;
    font-size: ${SIZE_FONT}px;
  }
  .vuerd-table .vuerd-table-header-top {
    overflow: hidden;
    cursor: move;
  }
  .vuerd-table .vuerd-table-header-top .vuerd-button {
    margin-left: 5px;
    float: right;
  }
  .vuerd-table .vuerd-table-header-body {
    height: ${SIZE_TABLE_HEADER_BODY_HEIGHT}px;
  }

  input.vuerd-input-edit {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    outline: none;
    border: none;
    opacity: 0.9;
    font-size: ${SIZE_FONT}px;
    font-family: "Noto Sans", "Cascadia Code", "JetBrains Mono", "D2Coding",
      "Consolas", sans-serif;
  }
  div.vuerd-input-edit,
  .vuerd-column-not-null {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    border-bottom: solid #fff0 1.5px;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    cursor: default;
  }
  .vuerd-column-key {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
  }
  .vuerd-column {
    height: ${SIZE_COLUMN_HEIGHT}px;
  }
  .vuerd-column-move {
    transition: transform 0.3s;
  }

  .vuerd-button {
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
    font-size: ${SIZE_FONT}px;
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

  .vuerd-text-width {
    visibility: hidden;
    position: fixed;
    top: -100px;
    font-size: ${SIZE_FONT}px;
    font-family: "Noto Sans", "Cascadia Code", "JetBrains Mono", "D2Coding",
      "Consolas", sans-serif;
  }

  .vuerd-sash {
    position: absolute;
    z-index: 1000;
  }
  .vuerd-sash.vertical {
    width: ${SIZE_SASH}px;
    height: 100%;
    cursor: ew-resize;
  }
  .vuerd-sash.horizontal {
    width: 100%;
    height: ${SIZE_SASH}px;
    cursor: ns-resize;
  }
  .vuerd-sash.edge {
    width: ${SIZE_SASH}px;
    height: ${SIZE_SASH}px;
  }

  .vuerd-memo {
    position: absolute;
    opacity: 0.9;
  }
  .vuerd-memo > .vuerd-memo-header {
    padding: ${SIZE_MEMO_PADDING}px;
    cursor: move;
  }
  .vuerd-memo > .vuerd-memo-header .vuerd-button {
    float: right;
  }
  .vuerd-memo > .vuerd-memo-body .vuerd-memo-textarea {
    padding: ${SIZE_MEMO_PADDING}px;
    opacity: 0.9;
    border: none;
    resize: none;
    outline: none;
    font-size: ${SIZE_FONT}px;
    font-family: "Noto Sans", "Cascadia Code", "JetBrains Mono", "D2Coding",
      "Consolas", sans-serif;
  }

  /* width */
  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  /* Track */
  ::-webkit-scrollbar-track {
    background: #fff0;
  }
  ::-webkit-scrollbar-corner {
    background: #fff0;
  }
`;

const ratioWidth = 16;
const ratioHeight = 9;
export const defaultWidth = 1200;
export const defaultHeight = (defaultWidth / ratioWidth) * ratioHeight;
