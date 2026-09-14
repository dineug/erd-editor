import { css } from '@dineug/r-html';

/*
 * Every menu and submenu, stacked over the floating toolbar: the bar is a
 * positioned z-index: 1 in the same stacking context and would win at auto.
 */
export const content = css`
  position: fixed;
  z-index: 2;
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  min-width: max-content;
  padding: 8px;
  background-color: var(--context-menu-background);
  border: 1px solid var(--context-menu-border);
`;
