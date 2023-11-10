import { css } from '@dineug/r-html';

export const viewport = css`
  position: absolute;
  border: solid 1.5px var(--minimap-viewport-border);
  cursor: pointer;

  &:hover {
    border-color: var(--minimap-viewport-border-hover);
  }

  &.selected {
    border-color: var(--minimap-viewport-border-hover);
  }
`;
