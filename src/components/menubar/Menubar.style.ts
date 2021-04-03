import { css } from '@/core/tagged';
import { SIZE_MENUBAR_HEIGHT, SIZE_FONT } from '@/core/layout';

export const MenubarStyle = css`
  .vuerd-menubar {
    height: ${SIZE_MENUBAR_HEIGHT}px;
    display: flex;
    align-items: center;
    overflow: hidden;
    background-color: var(--vuerd-color-menubar);
    box-sizing: border-box;
  }

  .vuerd-editor-status {
    width: 10px;
    height: 10px;
    margin-left: 15px;
    border-radius: 50%;
    transition: box-shadow 0.4s ease-in-out, background-color 0.4s ease-in-out;
  }

  .vuerd-editor-status.focus {
    background-color: var(--vuerd-color-focus);
    box-shadow: 0 0 5px var(--vuerd-color-focus), 0 0 20px rgb(255 255 0 / 0.8),
      0 0 35px rgb(255 255 0 / 0.7), 0 0 50px rgb(255 255 0 / 0.6);
  }

  .vuerd-editor-status.edit {
    background-color: var(--vuerd-color-edit);
    box-shadow: 0 0 5px var(--vuerd-color-edit), 0 0 20px rgb(255 255 0 / 0.8),
      0 0 35px rgb(255 255 0 / 0.7), 0 0 50px rgb(255 255 0 / 0.6);
  }

  .vuerd-menubar-input {
    margin-left: 15px;
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
