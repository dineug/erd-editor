import { css } from '@/core/tagged';

export const CanvasStyle = css`
  .vuerd-canvas-controller {
    position: relative;
    background-color: var(--vuerd-color-canvas);
    will-change: transform;
  }

  .vuerd-canvas {
    position: relative;
    background-color: var(--vuerd-color-canvas);
  }
`;
