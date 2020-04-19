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
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-color-font);
    background-color: var(--vuerd-color-canvas);
  }

  .vuerd-erd {
    position: relative;
    overflow: hidden;
  }

  .vuerd-canvas {
    position: relative;
    background-color: var(--vuerd-color-canvas);
  }

  .vuerd-canvas-svg {
    position: absolute;
    z-index: 1;
  }

  .vuerd-text-width {
    visibility: hidden;
    position: fixed;
    top: -100px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
  }

  .vuerd-button {
    cursor: pointer;
  }
  .vuerd-button:hover {
    fill: var(--vuerd-color-font-active);
  }

  /* =============== table ============== */
  .vuerd-table {
    position: absolute;
    opacity: 0.9;
    padding: ${SIZE_TABLE_PADDING}px;
    font-size: ${SIZE_FONT}px;
    fill: #fff0;
    background-color: var(--vuerd-color-table);
  }
  .vuerd-table:hover {
    fill: var(--vuerd-color-font);
  }
  .vuerd-table.active {
    border: solid var(--vuerd-color-table-active) 1px;
    box-shadow: 0 1px 6px var(--vuerd-color-table-active);
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

  /* =============== column ============== */
  .vuerd-column {
    height: ${SIZE_COLUMN_HEIGHT}px;
    fill: #fff0;
  }
  .vuerd-column:hover {
    fill: var(--vuerd-color-font);
  }
  .vuerd-column.select {
    background-color: var(--vuerd-color-column-select);
  }
  /* animation flip */
  .vuerd-column-move {
    transition: transform 0.3s;
  }

  .vuerd-input-edit {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-table);
  }
  input.vuerd-input-edit {
    outline: none;
    border: none;
    opacity: 0.9;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
  }
  div.vuerd-input-edit {
    border-bottom: solid #fff0 1.5px;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    cursor: default;
  }
  .vuerd-input-edit.select {
    background-color: var(--vuerd-color-column-select);
  }
  .vuerd-input-edit.focus {
    border-bottom: solid var(--vuerd-color-focus) 1.5px;
  }
  .vuerd-input-edit.edit {
    border-bottom: solid var(--vuerd-color-edit) 1.5px;
  }
  .vuerd-input-edit.placeholder {
    color: var(--vuerd-color-font-placeholder);
  }

  .vuerd-column-key {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    fill: #fff0;
  }
  .vuerd-column-key.pk {
    fill: var(--vuerd-color-key-pk);
  }
  .vuerd-column-key.fk {
    fill: var(--vuerd-color-key-fk);
  }
  .vuerd-column-key.pfk {
    fill: var(--vuerd-color-key-pfk);
  }

  .vuerd-column-not-null {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    border-bottom: solid #fff0 1.5px;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    cursor: default;
    color: var(--vuerd-color-font-active);
  }
  .vuerd-column-not-null.focus {
    border-bottom: solid var(--vuerd-color-focus) 1.5px;
  }

  .vuerd-column-data-type {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    position: relative;
  }
  vuerd-column-data-type-hint {
    position: absolute;
  }
  .vuerd-column-data-type-hint {
    position: absolute;
    opacity: 0.9;
    top: 10px;
    left: 0;
    z-index: 100000000;
    color: var(--vuerd-color-font);
    background-color: var(--vuerd-color-contextmenu);
  }
  .vuerd-column-data-type-hint > li {
    padding: 5px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
  }
  .vuerd-column-data-type-hint > li:hover {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
  }
  .vuerd-column-data-type-hint > li:hover .vuerd-mark {
    color: var(--vuerd-color-font-active);
  }
  .vuerd-data-type-hint.active {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
  }
  .vuerd-data-type-hint.active .vuerd-mark {
    color: var(--vuerd-color-font-active);
  }
  /* animation flip */
  .vuerd-data-type-hint-move {
    transition: transform 0.2s;
  }
  .vuerd-mark {
    color: var(--vuerd-color-mark);
  }

  /* =============== contextmenu ============== */
  .vuerd-contextmenu {
    position: fixed;
    z-index: 100000000;
    opacity: 0.9;
    color: var(--vuerd-color-font);
    fill: var(--vuerd-color-font);
    background-color: var(--vuerd-color-contextmenu);
  }
  .vuerd-contextmenu > li {
    padding: 10px 5px 10px 10px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
    white-space: nowrap;
  }
  .vuerd-contextmenu > li:hover {
    color: var(--vuerd-color-font-active);
    fill: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
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
    width: 70px;
    display: inline-block;
    padding-right: 0;
  }
  .vuerd-contextmenu > li > span.arrow {
    width: 13px;
    padding-right: 0;
  }

  /* =============== sash ============== */
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

  /* =============== memo ============== */
  .vuerd-memo {
    position: absolute;
    opacity: 0.9;
    fill: #fff0;
    background-color: var(--vuerd-color-table);
  }
  .vuerd-memo:hover {
    fill: var(--vuerd-color-font);
  }
  .vuerd-memo.active {
    border: solid var(--vuerd-color-table-active) 1px;
    box-shadow: 0 1px 6px var(--vuerd-color-table-active);
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
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-table);
  }

  /* =============== minimap ============== */
  .vuerd-minimap {
    position: absolute;
    z-index: 100000000;
    overflow: hidden;
    background-color: var(--vuerd-color-canvas);
    box-shadow: 10px 10px 30px 20px var(--vuerd-color-minimap-shadow);
  }
  .vuerd-minimap-canvas {
    position: relative;
  }
  .vuerd-minimap-canvas-svg {
    position: absolute;
    z-index: 1;
  }
  .vuerd-minimap-handle {
    position: absolute;
    z-index: 100000001;
    border: solid var(--vuerd-color-minimap-handle) 1px;
    cursor: pointer;
  }

  /* =============== scrollbar ============== */
  /* width */
  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  /* track */
  ::-webkit-scrollbar-track {
    background: #fff0;
  }
  ::-webkit-scrollbar-corner {
    background: #fff0;
  }
  /* handle */
  ::-webkit-scrollbar-thumb {
    background: var(--vuerd-color-scrollbar-thumb);
  }
  /* handle:hover */
  ::-webkit-scrollbar-thumb:hover {
    background: var(--vuerd-color-scrollbar-thumb-active);
  }
  /* firefox */
  .vuerd-scrollbar {
    scrollbar-color: var(--vuerd-color-scrollbar-thumb) #fff0;
    scrollbar-width: auto;
  }
`;

const ratioWidth = 16;
const ratioHeight = 9;
export const defaultWidth = 1200;
export const defaultHeight = (defaultWidth / ratioWidth) * ratioHeight;
