import { css } from "lit-element";

export const minimap = css`
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
    border: solid var(--vuerd-theme-edit, var(--vuerd-color-edit)) 1px;
    cursor: pointer;
    opacity: 0.7;
  }
  .vuerd-minimap-handle:hover {
    opacity: 1;
  }
`;
