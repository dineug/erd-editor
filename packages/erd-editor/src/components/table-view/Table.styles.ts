import { css } from '@dineug/r-html';

import {
  INPUT_MARGIN_RIGHT,
  TABLE_COLOR_WIDTH,
  TABLE_HEADER_BAND_PADDING,
  TABLE_HEADER_ICON_GAP,
  TABLE_HEADER_INPUT_HEIGHT,
  TABLE_HEADER_PADDING,
  TABLE_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/** The box that edge is cut from, wider than the 6px corner it has to round. */
const TABLE_COLOR_EDGE_BOX = 12;

export const root = css`
  position: absolute;
  background-color: var(--table-background);
  border-radius: 6px;
  border: 1px solid var(--table-border);
  color: transparent;
  ${typography.paragraph};

  &:hover {
    color: var(--foreground);
  }

  &[data-selected] {
    border: 1px solid var(--table-select);
  }

  &[data-shared-focus] {
    outline: 1px solid var(--shared-focus);
    outline-offset: 0;
  }

  &[data-shared-select]:not([data-shared-focus]) {
    box-shadow: 0 0 0 1px var(--shared-select);
  }

  & .input-padding[data-shared-focus] {
    box-shadow: inset 0 -1.5px 0 var(--shared-focus);
  }

  .column-row-move {
    transition: transform 0.3s;
  }

  .column-row:not(:last-child) {
    box-shadow: inset 0 -1px 0 var(--table-border);
  }
`;

/** The band the name stands in, one input line and its room as in the scene. */
export const header = css`
  display: flex;
  align-items: center;
  gap: ${TABLE_HEADER_ICON_GAP}px;
  padding: ${TABLE_HEADER_BAND_PADDING}px ${TABLE_PADDING}px;
  background-color: var(--table-header-background);
  border-radius: 5px 5px 0 0;

  &:last-child {
    border-radius: 5px;
  }

  & > .icon {
    flex-shrink: 0;
    color: var(--foreground);
  }
`;

/**
 * The colour along the left edge, over the border. The box is wider than the
 * corner it rounds and cut back to the strip, since a radius wider than its
 * own box is scaled down to fit and would no longer follow the card's.
 */
export const headerColor = css`
  position: absolute;
  top: -1px;
  bottom: -1px;
  left: -1px;
  width: ${TABLE_COLOR_EDGE_BOX}px;
  border-radius: 6px 0 0 6px;
  clip-path: inset(0 ${TABLE_COLOR_EDGE_BOX - TABLE_COLOR_WIDTH}px 0 0);
  pointer-events: none;
`;

export const headerInputWrap = css`
  display: flex;
  height: ${TABLE_HEADER_INPUT_HEIGHT}px;
  align-items: center;

  & > .input-padding {
    padding: ${TABLE_HEADER_PADDING}px ${INPUT_MARGIN_RIGHT}px
      ${TABLE_HEADER_PADDING}px 0;
  }
`;
