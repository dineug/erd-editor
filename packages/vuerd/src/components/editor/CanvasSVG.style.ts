import { css } from '@/core/tagged';

export const CanvasSVGStyle = css`
  .vuerd-canvas-svg {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
  }

  .vuerd-relationship {
    stroke: var(--vuerd-color-key-fk);
  }

  .vuerd-relationship.identification {
    stroke: var(--vuerd-color-key-pfk);
  }

  .vuerd-relationship.active {
    stroke: var(--vuerd-color-edit);
  }
`;
