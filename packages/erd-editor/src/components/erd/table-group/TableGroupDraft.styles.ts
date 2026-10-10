import { css } from '@dineug/r-html';

/**
 * The box a table group draw spans, outlined in the focus color over a fill of
 * it at the low alpha a group's body takes, so the canvas reads through.
 */
export const root = css`
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  border: 1px dashed var(--focus);
  border-radius: 6px;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-color: var(--focus);
    opacity: 0.12;
  }
`;
