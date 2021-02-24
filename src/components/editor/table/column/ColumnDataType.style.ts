import { css } from '@/core/tagged';
import { SIZE_FONT } from '@/core/layout';

export const ColumnDataTypeStyle = css`
  .vuerd-column-data-type {
    display: flex;
    vertical-align: middle;
    align-items: center;
    position: relative;
  }

  .vuerd-column-data-type-hint {
    position: absolute;
    opacity: 0.9;
    top: 20.5px;
    left: 0;
    z-index: 100000000;
    color: var(--vuerd-color-font);
    background-color: var(--vuerd-color-contextmenu);
    list-style: none;
    padding: 0;
    margin: 0;
    white-space: nowrap;
  }

  .vuerd-column-data-type-hint > li {
    padding: 5px;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
  }

  .vuerd-column-data-type-hint > li:hover,
  .vuerd-data-type-hint.active {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
  }

  .vuerd-column-data-type-hint > li:hover .vuerd-data-type-hint-mark,
  .vuerd-data-type-hint.active .vuerd-data-type-hint-mark {
    color: var(--vuerd-color-font-active);
  }

  /* animation flip */
  .vuerd-data-type-hint-move {
    transition: transform 0.2s;
  }

  .vuerd-data-type-hint-mark {
    color: var(--vuerd-color-edit);
  }
`;
