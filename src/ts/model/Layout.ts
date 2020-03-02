import { css } from "lit-element";

const ratioWidth = 16;
const ratioHeight = 9;
export const defaultWidth = 1200;
export const defaultHeight = (defaultWidth / ratioWidth) * ratioHeight;

export const Layout = css`
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
`;
