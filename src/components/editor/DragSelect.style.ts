import { css } from '@/core/tagged';

export const DragSelectStyle = css`
  .vuerd-drag-select {
    position: absolute;
    z-index: 100000001;
    stroke: var(--vuerd-color-focus);
    pointer-events: none;
  }
`;
