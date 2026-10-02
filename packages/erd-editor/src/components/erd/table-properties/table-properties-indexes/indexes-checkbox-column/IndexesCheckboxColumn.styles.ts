import { css } from '@dineug/r-html';

/**
 * The column rows at their own width, the tint running to the end of each
 * row however far the list scrolls sideways. A column of the picked index
 * or key wears the picked row's tint and bar; an idle list hovers no row.
 */
export const root = css`
  display: flex;
  flex-direction: column;
  width: max-content;
  min-width: 100%;

  & .column-row[data-selected] {
    box-shadow: inset 3px 0 0 var(--accent-color-10);
  }

  &:not([data-idle]) .column-row[data-selected]:hover {
    background-color: var(--column-select-hover);
  }

  &[data-idle] .column-row:not([data-selected]):hover {
    background-color: transparent;
  }

  & input[type='checkbox'] {
    appearance: none;
    display: block;
    flex: none;
    width: 14px;
    height: 14px;
    margin: 0;
    border-radius: 3px;
    background-color: transparent;
    box-shadow: inset 0 0 0 1px var(--gray-color-10);
    background-repeat: no-repeat;
    background-position: center;
    background-size: 10px;
    cursor: pointer;
  }

  & input[type='checkbox']:enabled:not(:checked):hover {
    box-shadow: inset 0 0 0 1px var(--gray-color-11);
  }

  & input[type='checkbox']:checked {
    background-color: var(--accent-color-9);
    box-shadow: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2 5.2 4.1 7.2 8 3' fill='none' stroke='%23fff' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  }

  & input[type='checkbox']:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }

  & input[type='checkbox']:disabled {
    cursor: default;
  }

  & input[type='checkbox']:disabled:checked {
    opacity: 1;
    background-color: var(--gray-color-9);
  }

  @media (forced-colors: active) {
    & input[type='checkbox'] {
      appearance: auto;
      background-image: none;
      box-shadow: none;
    }
  }
`;
