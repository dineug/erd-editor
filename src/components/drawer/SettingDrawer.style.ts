import { css } from '@/core/tagged';

export const SettingDrawerStyle = css`
  .vuerd-setting-drawer tbody tr td {
    padding-right: 20px;
    padding-bottom: 10px;
  }

  .vuerd-setting-drawer .vuerd-switch {
    position: relative;
    display: inline-block;
    width: 37.5px;
    height: 22.5px;
    overflow: hidden;
  }
  .vuerd-setting-drawer .vuerd-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .vuerd-setting-drawer .vuerd-switch > .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(
      --vuerd-theme-font-placeholder,
      var(--vuerd-color-font-placeholder)
    );
    transition: 0.3s;
  }
  .vuerd-setting-drawer .vuerd-switch > .slider:before {
    position: absolute;
    content: '';
    height: 15px;
    width: 15px;
    left: 3.75px;
    bottom: 3.75px;
    background-color: var(
      --vuerd-theme-font-active,
      var(--vuerd-color-font-active)
    );
    transition: 0.3s;
  }
  .vuerd-setting-drawer .vuerd-switch > input:checked + .slider {
    background-color: var(--vuerd-theme-focus, var(--vuerd-color-focus));
  }
  .vuerd-setting-drawer .vuerd-switch > input:focus + .slider {
    box-shadow: 0 0 1px var(--vuerd-theme-focus, var(--vuerd-color-focus));
  }
  .vuerd-setting-drawer .vuerd-switch > input:checked + .slider:before {
    transform: translateX(15px);
  }
  .vuerd-setting-drawer .vuerd-switch > .slider.round {
    border-radius: 34px;
  }
  .vuerd-setting-drawer .vuerd-switch > .slider.round:before {
    border-radius: 50%;
  }

  .vuerd-setting-drawer .vuerd-column-order {
    cursor: move;
    box-sizing: border-box;
    padding: 5px;
    display: inline-block;
  }
  .vuerd-setting-drawer .vuerd-column-order:hover {
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(
      --vuerd-theme-contextmenu-active,
      var(--vuerd-color-contextmenu-active)
    );
  }
  .vuerd-setting-drawer .vuerd-column-order.draggable {
    opacity: 0.5;
  }
  .vuerd-setting-drawer .vuerd-column-order.none-hover:hover {
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    background-color: var(
      --vuerd-theme-contextmenu,
      var(--vuerd-color-contextmenu)
    );
  }

  /* animation flip */
  .vuerd-setting-drawer .vuerd-column-order-move {
    transition: transform 0.3s;
  }
`;
