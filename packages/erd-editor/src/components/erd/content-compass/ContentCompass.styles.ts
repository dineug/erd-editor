import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

/*
 * The pill an empty screen carries, over the middle of the bottom edge: clear
 * of the scrollbar track under it and of the minimap in the far corner, and in
 * the one place a reader who has lost the document can always look for it.
 */
export const compass = css`
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  box-sizing: border-box;
  border: 1px solid var(--toast-border);
  border-radius: 14px;
  background-color: var(--toast-background);
  color: var(--foreground);
  cursor: pointer;
  user-select: none;

  &:hover {
    color: var(--active);
    border-color: var(--active);
  }
`;

/* Tabular figures, so the label does not jitter as the digits change under a pan. */
export const distance = css`
  ${typography.paragraph};
  font-variant-numeric: tabular-nums;
`;
