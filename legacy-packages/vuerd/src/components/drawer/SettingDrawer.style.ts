import { css } from '@/core/tagged';

export const SettingDrawerStyle = css`
  .vuerd-setting-drawer tbody tr td {
    padding-right: 20px;
    padding-bottom: 10px;
  }

  .vuerd-setting-drawer .vuerd-column-order {
    cursor: move;
    box-sizing: border-box;
    padding: 5px;
    display: inline-block;
  }
  .vuerd-setting-drawer .vuerd-column-order:hover {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
  }
  .vuerd-setting-drawer .vuerd-column-order.draggable {
    opacity: 0.5;
  }
  .vuerd-setting-drawer .vuerd-column-order.none-hover:hover {
    color: var(--vuerd-color-font);
    background-color: var(--vuerd-color-contextmenu);
  }

  /* animation flip */
  .vuerd-setting-drawer .vuerd-column-order-move {
    transition: transform 0.3s;
  }

  .vuerd-setting-drawer .vuerd-recalculating-table-width-button {
    box-sizing: border-box;
    padding: 5px;
    display: inline-block;
    cursor: pointer;
    fill: var(--vuerd-color-font);
    font-size: 15px;
  }
  .vuerd-setting-drawer .vuerd-recalculating-table-width-button:hover {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
    fill: var(--vuerd-color-font-active);
  }
`;
