import { css } from '@dineug/r-html';

import { floatingShadow } from '@/styles/elevation.styles';
import { fontSize5, typography } from '@/styles/typography.styles';

/**
 * A panel placed over whichever tab is up. The tab wrapper raises no stacking
 * context of its own, so a raised descendant inside it would paint over an
 * unraised sibling; the same step, later in the root, keeps this panel on top.
 */
export const root = css`
  position: absolute;
  top: 46px;
  left: 16px;
  z-index: 1;
  padding: 24px;
  background-color: var(--context-menu-background);
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  ${floatingShadow};
  width: 360px;
`;

export const title = css`
  color: var(--active);
  ${fontSize5};
  margin-bottom: 24px;
`;

export const subTitle = css`
  margin-top: 24px;
  color: var(--active);
  ${typography.normal};
`;

export const palette = css`
  margin-top: 12px;
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

export const lightDarkButtonGroup = css`
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`;

export const lightDarkButton = css`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  height: 32px;
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
