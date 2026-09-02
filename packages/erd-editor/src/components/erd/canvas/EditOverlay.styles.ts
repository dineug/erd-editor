import { css } from '@dineug/r-html';

import { CELL_TEXT_HEIGHT } from '@/components/erd/canvas/table/cellLayout';

/**
 * A cell editor, laid out on the text the scene drew rather than beside it. The
 * input's own line is centred in the same box konva centred one in, and it
 * paints no underline of its own: the scene's rect keeps running under it.
 */
export const cell = css`
  & .edit-input,
  & .edit-input.focus,
  & .edit-input.edit {
    height: ${CELL_TEXT_HEIGHT}px;
    border-bottom: 0 none;
    vertical-align: top;
  }
`;
