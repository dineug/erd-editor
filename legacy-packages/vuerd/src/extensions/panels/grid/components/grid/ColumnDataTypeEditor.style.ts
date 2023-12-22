import { SIZE_FONT } from '@/core/layout';
import { css } from '@/core/tagged';

export const ColumnDataTypeEditorStyle = css`
  .vuerd-grid-column-data-type-editor {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .vuerd-grid-column-data-type-hint {
    position: absolute;
    top: 41px;
    left: 0;
    z-index: 100;
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu);
    opacity: 0.9;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .vuerd-grid-column-data-type-hint > li {
    padding: 5px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
  }

  .vuerd-grid-column-data-type-hint > li:hover,
  .vuerd-grid-data-type-hint.active {
    background-color: var(--vuerd-color-contextmenu-active);
  }

  .vuerd-grid-column-data-type-hint
    > li:hover
    .vuerd-grid-column-data-type-hint-mark,
  .vuerd-grid-data-type-hint.active .vuerd-grid-column-data-type-hint-mark {
    color: var(--vuerd-color-font-active);
  }

  .vuerd-grid-column-data-type-hint-mark {
    color: var(--vuerd-color-edit);
  }

  /* animation flip */
  .vuerd-grid-data-type-hint-move {
    transition: transform 0.2s;
  }
`;
