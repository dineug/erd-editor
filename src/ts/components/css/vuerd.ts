import { css } from "lit-element";
import {
  SIZE_FONT,
  SIZE_SASH,
  SIZE_COLUMN_HEIGHT,
  SIZE_INPUT_EDIT_HEIGHT,
  SIZE_TABLE_PADDING,
  SIZE_TABLE_HEADER_BODY_HEIGHT,
  SIZE_MEMO_PADDING,
  SIZE_MENUBAR_HEIGHT,
  SIZE_COLUMN_MARGIN_RIGHT,
  SIZE_CONTEXTMENU_HEIGHT,
} from "@src/core/Layout";

export const vuerd = css`
  .vuerd-editor {
    position: relative;
    overflow: hidden;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family) !important;
    background-color: #f8f8f8;
  }

  .vuerd-erd {
    position: relative;
    overflow: hidden;
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    background-color: var(--vuerd-theme-canvas, var(--vuerd-color-canvas));
  }

  .vuerd-canvas {
    position: relative;
    background-color: var(--vuerd-theme-canvas, var(--vuerd-color-canvas));
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
    fill: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }

  .vuerd-visualization {
    height: 100%;
    overflow: auto;
    background-color: var(
      --vuerd-theme-visualization,
      var(--vuerd-color-visualization)
    );
  }

  .vuerd-sql,
  .vuerd-generator-code {
    height: calc(100% - ${SIZE_MENUBAR_HEIGHT}px);
    margin-top: ${SIZE_MENUBAR_HEIGHT}px;
    white-space: pre;
    box-sizing: border-box;
    background-color: #23241f;
    overflow: auto;
    font-family: monospace !important;
  }

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

  /* =============== table ============== */
  .vuerd-table {
    position: absolute;
    opacity: 0.9;
    padding: ${SIZE_TABLE_PADDING}px;
    font-size: ${SIZE_FONT}px;
    fill: #fff0;
    background-color: var(--vuerd-theme-table, var(--vuerd-color-table));
  }
  .vuerd-table:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-table.active {
    border: solid
      var(--vuerd-theme-table-active, var(--vuerd-color-table-active)) 1px;
    box-shadow: 0 1px 6px
      var(--vuerd-theme-table-active, var(--vuerd-color-table-active));
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
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-column.select {
    background-color: var(
      --vuerd-theme-column-select,
      var(--vuerd-color-column-select)
    );
  }
  .vuerd-column.active {
    background-color: var(
      --vuerd-theme-column-active,
      var(--vuerd-color-column-active)
    );
  }
  .vuerd-column.draggable {
    opacity: 0.5;
  }
  /* animation flip */
  .vuerd-column-move {
    transition: transform 0.3s;
  }

  vuerd-input-edit,
  vuerd-column-key,
  vuerd-column-not-null,
  vuerd-column-data-type {
    float: left;
  }
  .vuerd-input-edit {
    display: flex;
    vertical-align: middle;
    align-items: center;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(--vuerd-theme-table, var(--vuerd-color-table));
  }
  input.vuerd-input-edit {
    outline: none;
    border: none;
    opacity: 0.9;
    padding: 1px 0 1px 0;
    height: 17px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
  }
  div.vuerd-input-edit {
    border-bottom: solid #fff0 1.5px;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    cursor: default;
  }
  .vuerd-input-edit.select {
    background-color: var(
      --vuerd-theme-column-select,
      var(--vuerd-color-column-select)
    );
  }
  .vuerd-input-edit.active {
    background-color: var(
      --vuerd-theme-column-active,
      var(--vuerd-color-column-active)
    );
  }
  .vuerd-input-edit.focus {
    border-bottom: solid var(--vuerd-theme-focus, var(--vuerd-color-focus))
      1.5px;
  }
  .vuerd-input-edit.edit {
    border-bottom: solid var(--vuerd-theme-edit, var(--vuerd-color-edit)) 1.5px;
  }
  .vuerd-input-edit.placeholder {
    color: var(
      --vuerd-theme-font-placeholder,
      var(--vuerd-color-font-placeholder)
    );
  }

  .vuerd-column-key {
    display: flex;
    vertical-align: middle;
    align-items: center;
    fill: #fff0;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
  }
  .vuerd-column-key.pk {
    fill: var(--vuerd-theme-key-pk, var(--vuerd-color-key-pk));
  }
  .vuerd-column-key.fk {
    fill: var(--vuerd-theme-key-fk, var(--vuerd-color-key-fk));
  }
  .vuerd-column-key.pfk {
    fill: var(--vuerd-theme-key-pfk, var(--vuerd-color-key-pfk));
  }

  .vuerd-column-not-null {
    display: flex;
    vertical-align: middle;
    align-items: center;
    border-bottom: solid #fff0 1.5px;
    cursor: default;
    height: ${SIZE_INPUT_EDIT_HEIGHT}px;
    margin-right: ${SIZE_COLUMN_MARGIN_RIGHT}px;
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  .vuerd-column-not-null.focus {
    border-bottom: solid var(--vuerd-theme-focus, var(--vuerd-color-focus))
      1.5px;
  }

  .vuerd-column-data-type {
    display: flex;
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
    top: 11px;
    left: 0;
    z-index: 100000000;
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .vuerd-column-data-type-hint > li {
    padding: 5px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
  }
  .vuerd-column-data-type-hint > li:hover {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-column-data-type-hint > li:hover .vuerd-mark {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  .vuerd-data-type-hint.active {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-data-type-hint.active .vuerd-mark {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  /* animation flip */
  .vuerd-data-type-hint-move {
    transition: transform 0.2s;
  }
  .vuerd-mark {
    color: var(--vuerd-theme-mark, var(--vuerd-color-mark));
  }

  /* =============== relationship ============== */
  .vuerd-relationship {
    stroke: var(--vuerd-theme-key-fk, var(--vuerd-color-key-fk));
  }
  .vuerd-relationship.identification {
    stroke: var(--vuerd-theme-key-pfk, var(--vuerd-color-key-pfk));
  }
  .vuerd-relationship.active {
    stroke: var(
      --vuerd-theme-relationship-active,
      var(--vuerd-color-relationship-active)
    );
  }

  /* =============== DrawRelationship ============== */
  .vuerd-draw-relationship {
    position: absolute;
    top: 0;
    stroke: var(--vuerd-theme-key-fk, var(--vuerd-color-key-fk));
  }

  /* =============== memo ============== */
  .vuerd-memo {
    position: absolute;
    opacity: 0.9;
    fill: #fff0;
    background-color: var(--vuerd-theme-table, var(--vuerd-color-table));
  }
  .vuerd-memo:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-memo.active {
    border: solid
      var(--vuerd-theme-table-active, var(--vuerd-color-table-active)) 1px;
    box-shadow: 0 1px 6px
      var(--vuerd-theme-table-active, var(--vuerd-color-table-active));
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
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(--vuerd-theme-table, var(--vuerd-color-table));
  }

  /* =============== minimap ============== */
  .vuerd-minimap {
    position: absolute;
    z-index: 100000020;
    overflow: hidden;
    background-color: var(--vuerd-theme-canvas, var(--vuerd-color-canvas));
  }
  .vuerd-minimap-shadow {
    position: absolute;
    z-index: 100000010;
    box-shadow: 0 1px 6px
      var(--vuerd-theme-minimap-shadow, var(--vuerd-color-minimap-shadow));
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
    z-index: 100000030;
    border: solid
      var(--vuerd-theme-minimap-handle, var(--vuerd-color-minimap-handle)) 1px;
    cursor: pointer;
    opacity: 0.7;
  }
  .vuerd-minimap-handle:hover {
    opacity: 1;
  }

  /* =============== dragSelect ============== */
  .vuerd-drag-select {
    position: fixed;
    z-index: 100000001;
    stroke: var(--vuerd-theme-drag-select, var(--vuerd-color-drag-select));
  }

  /* =============== menubar ============== */
  .vuerd-menubar {
    width: 100%;
    position: absolute;
    overflow: hidden;
    z-index: 100001000;
    display: flex;
    align-items: center;
    height: ${SIZE_MENUBAR_HEIGHT}px;
    background-color: var(--vuerd-theme-menubar, var(--vuerd-color-menubar));
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .vuerd-menubar > .vuerd-menubar-input {
    margin-left: 20px;
  }
  .vuerd-menubar > .vuerd-menubar-input input {
    outline: none;
    border: none;
    opacity: 0.9;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(--vuerd-theme-menubar, var(--vuerd-color-menubar));
  }
  .vuerd-menubar > .vuerd-menubar-menu {
    cursor: pointer;
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
    margin-left: 10px;
  }
  .vuerd-menubar > .vuerd-menubar-menu.active {
    fill: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  .vuerd-menubar > .vuerd-menubar-menu:hover {
    fill: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }

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
  .vuerd-grid-column-option-editor > li:hover {
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
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
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .vuerd-grid-column-data-type-hint > li {
    padding: 5px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
  }
  .vuerd-grid-column-data-type-hint > li:hover {
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-grid-column-data-type-hint > li:hover .vuerd-mark {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  .vuerd-grid-data-type-hint.active {
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-grid-data-type-hint.active .vuerd-mark {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }
  /* animation flip */
  .vuerd-grid-data-type-hint-move {
    transition: transform 0.2s;
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
    background: var(
      --vuerd-theme-scrollbar-thumb,
      var(--vuerd-color-scrollbar-thumb)
    );
  }
  /* handle:hover */
  ::-webkit-scrollbar-thumb:hover {
    background: var(
      --vuerd-theme-scrollbar-thumb-active,
      var(--vuerd-color-scrollbar-thumb-active)
    );
  }
  /* firefox */
  .vuerd-scrollbar {
    scrollbar-color: var(
        --vuerd-theme-scrollbar-thumb,
        var(--vuerd-color-scrollbar-thumb)
      )
      #fff0;
    scrollbar-width: auto;
  }
`;
