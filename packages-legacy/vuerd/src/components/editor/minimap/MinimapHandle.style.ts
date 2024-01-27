import { css } from '@/core/tagged';

export const MinimapHandleStyle = css`
  .vuerd-minimap-handle {
    position: absolute;
    border: solid var(--vuerd-color-edit) 1px;
    cursor: pointer;
    opacity: 0.7;
  }

  .vuerd-minimap-handle:hover {
    opacity: 1;
  }

  .vuerd-minimap-handle[data-selected] {
    opacity: 1;
  }
`;
