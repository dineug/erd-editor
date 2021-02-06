import { css } from '@/core/tagged';

export const MenuGroupStyle = css`
  .vuerd-menubar-menu {
    cursor: pointer;
    fill: var(--vuerd-color-font);
    margin-left: 10px;
  }

  .vuerd-menubar-menu.active,
  .vuerd-menubar-menu:hover {
    fill: var(--vuerd-color-font-active);
  }
`;
