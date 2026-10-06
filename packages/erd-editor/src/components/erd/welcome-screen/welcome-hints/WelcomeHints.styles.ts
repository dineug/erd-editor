import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

/**
 * A hint under a toolbar button: its arrow climbs from the label to just
 * under the bar, and the label hangs a little below the arrow's tail. Where it
 * stands across the canvas is set inline, from the button it was measured at.
 */
export const up = css`
  position: absolute;
  top: 4px;
  width: max-content;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  color: var(--foreground);
  pointer-events: none;

  & > svg {
    flex: none;
  }

  & > span {
    margin-block-end: -8px;
  }
`;

/**
 * The hint over the floating toolbar, centred over it as the toolbar is, its
 * arrow's tip clear of the bar's top edge.
 */
export const down = css`
  position: absolute;
  bottom: 68px;
  inset-inline: 0;
  width: max-content;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--foreground);
  pointer-events: none;
`;

/** A label a longer language wraps rather than run under the next hint, Japanese between phrases, never mid-word. */
export const label = css`
  max-width: 220px;
  white-space: normal;
  word-break: auto-phrase;
  text-align: center;
  ${typography.normal};
`;
