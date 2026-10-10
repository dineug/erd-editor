import { css } from '@dineug/r-html';

/*
 * The menu's own border color, drawn as a border, which forced colors keep where
 * they would paint a background in the menu's color. As wide as a row's highlight.
 */
export const separator = css`
  height: 0;
  margin: 4px 0;
  border-top: 1px solid var(--context-menu-border);
`;
