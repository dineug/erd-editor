import { css } from '@/core/tagged';

export const ERDStyle = css`
  .vuerd-erd {
    overflow: hidden;
    position: relative;
  }

  .vuerd-erd-background {
    width: 100%;
    height: 100%;
    pointer-events: none;
    float: left;
    background-color: var(--vuerd-color-canvas);
    opacity: 0.95;
  }
`;
