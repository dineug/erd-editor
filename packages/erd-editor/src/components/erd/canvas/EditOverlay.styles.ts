import { css } from '@dineug/r-html';

/**
 * A cell editor, laid out on the text the scene drew rather than beside it. The
 * input's own line is centred in the same box konva centred one in, and it
 * paints no underline of its own: the scene's rect keeps running under it.
 */
export const cell = css`
  & .edit-input,
  & .edit-input.focus,
  & .edit-input.edit {
    height: var(--cell-text-height);
    border-bottom: 0 none;
    vertical-align: top;
  }
`;

/**
 * A tinted header's text color, on the input alone: the term list a logical
 * name opens under it paints the table's background, so its text and keys
 * keep the theme's colors, which read there.
 */
export const tinted = css`
  & .edit-input {
    --active: var(--cell-text-color);
    --placeholder: var(--cell-text-color);
  }
`;
