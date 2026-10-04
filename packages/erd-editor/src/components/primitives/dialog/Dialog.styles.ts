import { css } from '@dineug/r-html';

import { floatingShadow } from '@/styles/elevation.styles';

/**
 * Dims the whole editor and hangs the box from the palette's line. It stacks
 * one under the toasts, which report what the dialog's buttons did, and the
 * palette, drawn after it at the toasts' height, still opens over it.
 */
export const root = css`
  position: absolute;
  inset: 0;
  z-index: 2147483646;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 60px 16px 16px;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.4);
  }
`;

/**
 * The box over the dim, as tall as its content and never past the editor; a
 * short editor scrolls it, so the controls at its foot stay in reach.
 */
export const content = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 100%;
  position: relative;
  z-index: 1;
  background-color: var(--context-menu-background);
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  ${floatingShadow};
  overflow: auto;
  outline: none;
`;
