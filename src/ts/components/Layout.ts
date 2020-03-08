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

  .vuerd-contextmenu > ul {
    position: fixed;
    z-index: 100000000;
    opacity: 0.9;
  }
  .vuerd-contextmenu > ul > li {
    padding: 10px;
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
  }
  .vuerd-contextmenu > ul > li > span {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    overflow: hidden;
    padding-right: 10px;
  }
  .vuerd-contextmenu > ul > li > span.icon {
    width: 16px;
  }
  .vuerd-contextmenu > ul > li > span.icon > img {
    width: 16px;
  }
  .vuerd-contextmenu > ul > li > span.name {
    width: 110px;
  }
  .vuerd-contextmenu > ul > li > span.keymap {
    width: 50px;
    display: inline-block;
    padding-right: 0;
  }
  .vuerd-contextmenu > ul > li > span.arrow {
    width: 100%;
    padding-right: 0;
  }
`;

const ratioWidth = 16;
const ratioHeight = 9;
export const defaultWidth = 1200;
export const defaultHeight = (defaultWidth / ratioWidth) * ratioHeight;
