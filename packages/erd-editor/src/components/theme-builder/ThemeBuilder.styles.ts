import { css } from '@dineug/r-html';

import { floatingShadow } from '@/styles/elevation.styles';
import { typography } from '@/styles/typography.styles';

/**
 * A panel placed over whichever tab is up, padded as Find and Replace is. The
 * tab wrapper raises no stacking context, so a raised descendant would paint
 * over an unraised sibling; the same step later in the root keeps this on top.
 */
export const root = css`
  position: absolute;
  top: 46px;
  inset-inline-start: 16px;
  z-index: 1;
  padding: 12px;
  background-color: var(--context-menu-background);
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  ${floatingShadow};
  width: 360px;
`;

/* The title and the close button on one line, the button at the end the line ends at. */
export const header = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

/* Set as Find and Replace and the locale picker set theirs. */
export const title = css`
  color: var(--active);
  ${typography.normal};
`;

/** A 26px square tool tinted under the pointer, as the editor's other panels close. */
export const close = css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }
`;

export const subTitle = css`
  margin-top: 12px;
  color: var(--foreground);
  ${typography.paragraph};
`;

export const palette = css`
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 8px;
`;

export const color = css`
  border-radius: 9999px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  border: 1px solid transparent;

  &.selected {
    outline: solid 2px var(--gray-color-12);
  }
`;

/* Equal thirds, except that a label longer than its third widens its own button rather than wrap. */
export const appearanceButtonGroup = css`
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(3, minmax(max-content, 1fr));
  gap: 8px;
`;

export const appearanceButton = css`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  height: 32px;
  padding-inline: 8px;
  ${typography.paragraph};

  &:hover {
    background-color: var(--column-hover);
  }

  &.selected {
    border-color: var(--gray-color-12);
  }
`;

export const vertical = css`
  width: 4px;
  height: 100%;
`;
