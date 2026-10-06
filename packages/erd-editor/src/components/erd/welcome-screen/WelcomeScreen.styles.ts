import { css } from '@dineug/r-html';

import { fontSize7, typography } from '@/styles/typography.styles';

/**
 * The layer over the empty canvas, which lets every press and wheel through
 * to the scene but the menu's, so a drag over the heading still pans. Its
 * left edge is set inline, clear of an open Find and Replace panel.
 */
export const root = css`
  position: absolute;
  inset: 0;
  pointer-events: none;
  user-select: none;
`;

/**
 * The block centred in the room over the floating toolbar, whose top edge
 * stands 60px over the canvas's bottom, so the last row never runs under it.
 */
export const center = css`
  position: absolute;
  inset-block: 0 60px;
  inset-inline: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
`;

export const name = css`
  ${fontSize7};
  font-weight: var(--font-weight-medium);
  color: var(--active);
`;

export const heading = css`
  ${typography.normal};
  max-width: 100%;
  color: var(--foreground);
  text-align: center;
`;

/** The one part of the layer that takes the pointer, as a press on a row is no pan. */
export const menu = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 300px;
  max-width: 100%;
  margin-block-start: 16px;
  pointer-events: auto;
`;

export const item = css`
  ${typography.normal};
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 32px;
  padding-inline: 12px;
  border-radius: 6px;
  color: var(--foreground);
  text-align: start;
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }

  &:focus-visible {
    color: var(--active);
    box-shadow: inset 0 0 0 1px var(--input-active);
  }
`;

export const label = css`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
