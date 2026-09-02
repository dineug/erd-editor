import { css } from '@dineug/r-html';

import {
  CELL_TEXT_HEIGHT,
  CELL_UNDERLINE_Y,
} from '@/components/erd/canvas/table/cellLayout';

/**
 * A cell editor, laid out on the text the scene drew rather than beside it. The
 * input's own line is centred in the same box konva centred one in, and the
 * underline is painted at the y the scene's rect ran along.
 */
export const cell = css`
  background-image: linear-gradient(
    to bottom,
    transparent ${CELL_UNDERLINE_Y}px,
    var(--input-active) ${CELL_UNDERLINE_Y}px
  );
  background-repeat: no-repeat;
  background-size: 100% ${CELL_TEXT_HEIGHT}px;
  background-position: 0 0;

  & .edit-input,
  & .edit-input.focus,
  & .edit-input.edit {
    height: ${CELL_TEXT_HEIGHT}px;
    border-bottom: 0 none;
    vertical-align: top;
    transform: translateY(var(--cell-text-snap, 0px));
  }
`;
