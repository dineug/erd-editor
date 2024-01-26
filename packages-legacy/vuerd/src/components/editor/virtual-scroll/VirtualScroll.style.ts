import { css } from '@/core/tagged';

export const VirtualScrollStyle = css`
  .vuerd-erd-virtual-scroll-horizontal {
    position: absolute;
    left: 0;
    bottom: 0;
    width: calc(100% - 8px);
    height: 8px;
    overflow: hidden;
    padding-left: 4px;
  }

  .vuerd-erd-virtual-scroll-vertical {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: calc(100% - 8px);
    overflow: hidden;
    padding-top: 4px;
  }

  .ghostThumb {
    will-change: transform;
    cursor: pointer;
  }

  .ghostThumb:hover > div {
    background-color: var(--vuerd-color-scrollbar-thumb-active);
  }

  .ghostThumb[data-selected] > div {
    background-color: var(--vuerd-color-scrollbar-thumb-active);
  }

  .verticalThumb {
    width: 4px;
    height: 100%;
    background-color: var(--vuerd-color-scrollbar-thumb);
    border-radius: 4px;
  }

  .horizontalThumb {
    width: 100%;
    height: 4px;
    background-color: var(--vuerd-color-scrollbar-thumb);
    border-radius: 4px;
  }
`;
