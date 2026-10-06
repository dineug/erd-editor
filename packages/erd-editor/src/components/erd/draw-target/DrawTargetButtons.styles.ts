import { css } from '@dineug/r-html';

/** The buttons' own size on screen at any zoom, read by the placement too. */
export const PILL_BUTTON = 26;
export const PILL_COARSE_BUTTON = 40;
export const PILL_PADDING = 4;
export const PILL_BORDER = 1;
export const PILL_GAP = 2;
export const PILL_COARSE_GAP = 8;

/** The canvas-sized layer the outline, the gutter and the buttons stand in. */
export const layer = css`
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
`;

/** The table the buttons act on, outlined in the colour of the draw's preview line. */
export const outline = css`
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  border: 2px solid var(--key-fk);
  border-radius: 4px;
  pointer-events: none;
`;

export const gutter = css`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: auto;
`;

/** The floating toolbar's pill, stood on its end. */
export const pill = css`
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${PILL_PADDING}px;
  gap: ${PILL_GAP}px;
  border: ${PILL_BORDER}px solid var(--toast-border);
  border-radius: 6px;
  background-color: var(--toast-background);
  box-shadow: 0 1px 6px -3px var(--minimap-shadow);
  pointer-events: auto;

  @media (pointer: coarse) {
    gap: ${PILL_COARSE_GAP}px;
  }
`;

export const button = css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${PILL_BUTTON}px;
  height: ${PILL_BUTTON}px;
  padding: 0;
  border-radius: 6px;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--gray-color-3);
  }

  &[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.4;
    color: var(--foreground);
    background-color: transparent;
  }

  @media (pointer: coarse) {
    width: ${PILL_COARSE_BUTTON}px;
    height: ${PILL_COARSE_BUTTON}px;
  }
`;
