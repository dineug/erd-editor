import { css } from '@/core/tagged';
import { SIZE_MENUBAR_HEIGHT, SIZE_FONT } from '@/core/layout';

export const MenubarStyle = css`
  .vuerd-menubar {
    height: ${SIZE_MENUBAR_HEIGHT}px;
    display: flex;
    align-items: center;
    overflow: hidden;
    background-color: var(--vuerd-color-menubar);
  }

  .vuerd-menubar-input {
    margin-left: 20px;
    outline: none;
    border: none;
    opacity: 0.9;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-menubar);
  }

  .vuerd-menubar-menu {
    cursor: pointer;
    fill: var(--vuerd-color-font);
    margin-left: 10px;
  }

  .vuerd-menubar-menu.active,
  .vuerd-menubar-menu:hover {
    fill: var(--vuerd-color-font-active);
  }

  .vuerd-menubar-menu.undo-redo {
    cursor: not-allowed;
    fill: var(--vuerd-color-font);
  }

  .vuerd-menubar-menu.undo-redo.active {
    cursor: pointer;
    fill: var(--vuerd-color-font-active);
  }

  .vuerd-menubar-menu-vertical {
    margin-left: 10px;
  }
`;
