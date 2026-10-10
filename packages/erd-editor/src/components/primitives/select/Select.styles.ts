import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

/**
 * The chevron over the list's end, the clicks passing through it to the list.
 * Its ink starts 5/24 into its 14 px box, so 7 px off the edge puts it 8.9 px
 * past the border, where a value's first letter stands past its 8 px padding.
 */
export const chevron = css`
  grid-area: 1 / 1;
  justify-self: end;
  display: flex;
  margin-inline-end: 7px;
  pointer-events: none;
`;

/**
 * A native list in the editor's colours, the browser's arrow off and the
 * editor's chevron in its place, a value never running under it; its popup
 * takes the appearance from color-scheme.
 */
export const root = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  color: var(--active);

  &[data-dimmed] {
    color: var(--placeholder);
  }

  & > select {
    grid-area: 1 / 1;
    width: 100%;
    min-width: 0;
    height: 28px;
    margin: 0;
    padding-block: 0;
    padding-inline: 8px 26px;
    appearance: none;
    border: 1px solid var(--context-menu-border);
    border-radius: 4px;
    color: inherit;
    background-color: var(--context-menu-background);
    text-overflow: ellipsis;
    ${typography.paragraph};
  }

  & > select:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }

  & > select:disabled,
  & > select:disabled + ${chevron} {
    color: var(--placeholder);
  }

  @media (forced-colors: active) {
    & > ${chevron} {
      color: FieldText;
    }

    & > select:disabled + ${chevron} {
      color: GrayText;
    }
  }
`;
